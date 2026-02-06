import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { action } from '@ember/object';
import moment from 'moment-timezone';
import { encryptedZones, feeds } from 'crimeisdown/utils/audio-feed-config';

const LOCAL_TZ = 'America/Chicago';
const DATE_INPUT_FORMAT = 'M/D/YYYY h:mm A';
const DATE_API_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const COMMANDER_CHECKOUT_URL =
  'https://www.patreon.com/checkout/EricTendian/1260099';

export default class AudioRangeExportComponent extends Component {
  @service config;
  @service session;

  @tracked authReady = false;
  @tracked selectedFeed = '';
  @tracked startDate = null;
  @tracked endDate = null;

  @tracked isSubmitting = false;
  @tracked createError = '';

  @tracked jobId = null;
  @tracked status = null;
  @tracked requestedHours = null;
  @tracked processedHours = 0;
  @tracked missingHours = [];
  @tracked downloadUrl = null;
  @tracked jobError = '';

  pollHandle = null;

  feeds = feeds;
  encryptedZones = encryptedZones;
  startPickerOptions = {
    enableTime: true,
    minuteIncrement: 60,
    dateFormat: 'n/j/Y h:i K',
  };
  endPickerOptions = {
    enableTime: true,
    minuteIncrement: 60,
    dateFormat: 'n/j/Y h:i K',
  };

  constructor() {
    super(...arguments);
    this.startDate = moment
      .tz(LOCAL_TZ)
      .subtract(2, 'hours')
      .startOf('hour')
      .toDate();
    this.endDate = moment
      .tz(LOCAL_TZ)
      .subtract(1, 'hours')
      .startOf('hour')
      .toDate();
  }

  willDestroy(...args) {
    this.stopPolling();
    super.willDestroy(...args);
  }

  get canUseRangeExport() {
    const user = this.session.user;
    return Boolean(
      this.session.isAuthenticated &&
      user &&
      (user.is_admin || (user.patreon_tier?.rate ?? 0) >= 50),
    );
  }

  get loginUrl() {
    return `${this.config.get('API_BASE_URL')}/auth/redirect`;
  }

  get commanderCheckoutUrl() {
    return COMMANDER_CHECKOUT_URL;
  }

  get submitDisabled() {
    return this.isSubmitting || !this.canUseRangeExport;
  }

  get hasJobResult() {
    return Boolean(this.jobId);
  }

  get statusBadgeClass() {
    switch (this.status) {
      case 'succeeded':
        return 'text-bg-success';
      case 'failed':
        return 'text-bg-danger';
      case 'processing':
        return 'text-bg-warning';
      default:
        return 'text-bg-secondary';
    }
  }

  @action
  async initialize() {
    if (this.authReady) {
      return;
    }
    await this.session.authenticated;
    this.authReady = true;
  }

  @action
  async submit(event) {
    event.preventDefault();
    this.resetMessages();
    await this.initialize();

    if (!this.canUseRangeExport) {
      this.createError =
        'Only Commander tier and above can request merged range exports.';
      return;
    }

    const { payload, error } = this.buildPayload(event.target);
    if (error) {
      this.createError = error;
      return;
    }

    this.isSubmitting = true;
    this.stopPolling();
    this.resetJobState();

    try {
      const xsrfToken = await this.ensureXsrfToken();
      const response = await window.fetch(
        `${this.config.get('API_BASE_URL')}/api/audio-range-exports`,
        {
          ...this.session.fetchOptions,
          method: 'POST',
          headers: {
            ...this.session.fetchOptions.headers,
            ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.status !== 202) {
        this.createError = await this.readErrorMessage(response);
        return;
      }

      const data = await response.json();
      this.jobId = data.id;
      this.status = data.status;
      this.requestedHours = data.requested_hours;
      this.processedHours = 0;
      this.startPolling(data.status_url);
    } catch (e) {
      this.createError = e.message || 'Could not create range export.';
    } finally {
      this.isSubmitting = false;
    }
  }

  buildPayload(form) {
    const rawFeed = form.elements.feed?.value?.trim();
    const rawStart = form.elements.start_datetime?.value?.trim();
    const rawEnd = form.elements.end_datetime?.value?.trim();

    if (!rawFeed || !rawStart || !rawEnd) {
      return { error: 'Feed, start time, and end time are required.' };
    }

    const start = moment.tz(rawStart, DATE_INPUT_FORMAT, true, LOCAL_TZ);
    const end = moment.tz(rawEnd, DATE_INPUT_FORMAT, true, LOCAL_TZ);

    if (!start.isValid() || !end.isValid()) {
      return {
        error: `Datetime must match format ${DATE_INPUT_FORMAT}.`,
      };
    }

    if (!end.isAfter(start)) {
      return { error: 'End time must be after start time.' };
    }

    if (
      start.minutes() !== 0 ||
      start.seconds() !== 0 ||
      end.minutes() !== 0 ||
      end.seconds() !== 0
    ) {
      return {
        error: 'Start and end times must be hour-aligned (mm:ss = 00:00).',
      };
    }

    if (end.diff(start, 'hours', true) > 24) {
      return {
        error: 'Time range must be 24 hours or less.',
      };
    }

    const cutoff = this.encryptedZones[rawFeed];
    let broadcastify = false;
    if (cutoff) {
      const cutoffMoment = moment.tz(cutoff, DATE_API_FORMAT, true, LOCAL_TZ);
      if (start.isBefore(cutoffMoment) && end.isAfter(cutoffMoment)) {
        return {
          error:
            'This range crosses the encrypted cutover time. Please split it into two separate exports.',
        };
      }
      broadcastify = start.isSameOrAfter(cutoffMoment);
    }

    return {
      payload: {
        feed: rawFeed,
        start_datetime: start.format(DATE_API_FORMAT),
        end_datetime: end.format(DATE_API_FORMAT),
        broadcastify,
      },
    };
  }

  startPolling(statusUrl) {
    const endpoint = this.normalizeStatusUrl(statusUrl);
    this.stopPolling();

    const poll = async () => {
      try {
        const response = await window.fetch(
          endpoint,
          this.session.fetchOptions,
        );
        if (response.status !== 200) {
          this.status = 'failed';
          this.jobError = await this.readErrorMessage(response);
          this.stopPolling();
          return;
        }

        const data = await response.json();
        this.status = data.status;
        this.requestedHours = data.requested_hours;
        this.processedHours = data.processed_hours;
        this.missingHours = data.missing_hours || [];
        this.downloadUrl = data.download_url || null;
        this.jobError = data.error || '';

        if (this.status === 'succeeded' || this.status === 'failed') {
          this.stopPolling();
        }
      } catch (e) {
        this.status = 'failed';
        this.jobError = e.message || 'Could not fetch export status.';
        this.stopPolling();
      }
    };

    poll();
    this.pollHandle = window.setInterval(poll, 5000);
  }

  stopPolling() {
    if (!this.pollHandle) {
      return;
    }
    window.clearInterval(this.pollHandle);
    this.pollHandle = null;
  }

  normalizeStatusUrl(statusUrl) {
    const baseUrl = this.config.get('API_BASE_URL');
    if (!statusUrl) {
      return `${baseUrl}/api/audio-range-exports/${this.jobId}`;
    }
    if (statusUrl.startsWith('http://') || statusUrl.startsWith('https://')) {
      return statusUrl;
    }
    return `${baseUrl}${statusUrl}`;
  }

  getXsrfToken() {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('XSRF-TOKEN='))
      ?.split('=')[1];
    if (!token) {
      return null;
    }
    return decodeURIComponent(token);
  }

  async ensureXsrfToken() {
    let token = this.getXsrfToken();
    if (token) {
      return token;
    }

    try {
      await window.fetch(
        `${this.config.get('API_BASE_URL')}/sanctum/csrf-cookie`,
        {
          headers: {
            Accept: 'application/json',
          },
          credentials: 'include',
        },
      );
    } catch {
      // Fall through and try existing cookie value again.
    }

    token = this.getXsrfToken();
    return token;
  }

  async readErrorMessage(response) {
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.message) {
          return data.message;
        }
        if (data.error) {
          return data.error;
        }
        if (data.errors) {
          return Object.values(data.errors).flat().join('\n');
        }
      }
      const text = await response.text();
      if (text) {
        return text;
      }
    } catch {
      // fall through to generic error below
    }
    return `Request failed with status ${response.status}.`;
  }

  resetMessages() {
    this.createError = '';
    this.jobError = '';
  }

  resetJobState() {
    this.jobId = null;
    this.status = null;
    this.requestedHours = null;
    this.processedHours = 0;
    this.missingHours = [];
    this.downloadUrl = null;
  }
}
