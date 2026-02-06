import { module, test } from 'qunit';
import { setupRenderingTest } from 'crimeisdown/tests/helpers';
import { render, click, fillIn, settled } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import Service from '@ember/service';

function mockJsonResponse(status, data) {
  return {
    status,
    headers: {
      get(name) {
        if (name.toLowerCase() === 'content-type') {
          return 'application/json';
        }
        return null;
      },
    },
    async json() {
      return data;
    },
    async text() {
      return JSON.stringify(data);
    },
  };
}

module('Integration | Component | audio-range-export', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.owner.lookup('service:config').set('API_BASE_URL', 'https://api.test');

    this.originalFetch = globalThis.fetch;
    this.fetchQueue = [];
    this.fetchCalls = [];
    globalThis.fetch = async (url, options = {}) => {
      this.fetchCalls.push({ url, options });
      if (!this.fetchQueue.length) {
        throw new Error(`Unexpected fetch request to ${url}`);
      }
      return this.fetchQueue.shift();
    };

    this.originalSetInterval = window.setInterval;
    this.originalClearInterval = window.clearInterval;
    this.pollCallback = null;
    this.clearedPollId = null;
    window.setInterval = (callback) => {
      this.pollCallback = callback;
      return 777;
    };
    window.clearInterval = (id) => {
      this.clearedPollId = id;
    };

    document.cookie = 'XSRF-TOKEN=test-xsrf-token; path=/';
  });

  hooks.afterEach(function () {
    globalThis.fetch = this.originalFetch;
    window.setInterval = this.originalSetInterval;
    window.clearInterval = this.originalClearInterval;
    document.cookie =
      'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  function registerSession(owner, options = {}) {
    const {
      isAuthenticated: authValue = false,
      user: userValue = undefined,
      fetchOptions: fetchOptionsValue = {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      },
    } = options;

    owner.register(
      'service:session',
      class SessionStub extends Service {
        isAuthenticated = authValue;
        user = userValue;
        fetchOptions = fetchOptionsValue;
        authenticated = Promise.resolve(authValue);
      },
    );
  }

  test('it shows login CTA and disables submit for unauthenticated users', async function (assert) {
    registerSession(this.owner, {
      isAuthenticated: false,
      user: undefined,
    });

    await render(hbs`<AudioRangeExport />`);

    assert.dom('[data-test-range-login-cta]').exists();
    assert.dom('[data-test-range-submit]').isDisabled();
  });

  test('it shows upgrade CTA and disables submit for non-Commander users', async function (assert) {
    registerSession(this.owner, {
      isAuthenticated: true,
      user: {
        is_admin: false,
        patreon_tier: {
          rate: 20,
        },
      },
    });

    await render(hbs`<AudioRangeExport />`);

    assert.dom('[data-test-range-upgrade-cta]').exists();
    assert.dom('[data-test-range-submit]').isDisabled();
  });

  test('it creates export, polls status, and renders download link for Commander users', async function (assert) {
    registerSession(this.owner, {
      isAuthenticated: true,
      user: {
        is_admin: false,
        patreon_tier: {
          rate: 50,
        },
      },
    });

    this.fetchQueue.push(
      mockJsonResponse(202, {
        id: 'job-1',
        status: 'queued',
        requested_hours: 4,
        status_url: '/api/audio-range-exports/job-1',
      }),
      mockJsonResponse(200, {
        id: 'job-1',
        status: 'processing',
        requested_hours: 4,
        processed_hours: 2,
        missing_hours: [],
      }),
      mockJsonResponse(200, {
        id: 'job-1',
        status: 'succeeded',
        requested_hours: 4,
        processed_hours: 3,
        missing_hours: ['2026-02-05T11:00:00-06:00'],
        download_url: 'https://download.test/range.mp3',
      }),
    );

    await render(hbs`<AudioRangeExport />`);

    await fillIn('[data-test-range-feed]', 'zone1');
    await fillIn('input[name="start_datetime"]', '2/5/2026 10:00 AM');
    await fillIn('input[name="end_datetime"]', '2/5/2026 2:00 PM');
    await click('[data-test-range-submit]');

    assert.strictEqual(
      this.fetchCalls.length,
      2,
      'POST + first status poll called',
    );
    assert.strictEqual(
      this.fetchCalls[0].url,
      'https://api.test/api/audio-range-exports',
      'creates range export against new API endpoint',
    );

    const payload = JSON.parse(this.fetchCalls[0].options.body);
    assert.deepEqual(payload, {
      feed: 'zone1',
      start_datetime: '2026-02-05 10:00:00',
      end_datetime: '2026-02-05 14:00:00',
      broadcastify: true,
    });

    assert.dom('[data-test-range-job-status]').hasText('processing');

    await this.pollCallback();
    await settled();

    assert.dom('[data-test-range-job-status]').hasText('succeeded');
    assert
      .dom('[data-test-range-download]')
      .hasAttribute('href', 'https://download.test/range.mp3');
    assert
      .dom('[data-test-range-missing-hours]')
      .includesText('2026-02-05T11:00:00-06:00');
    assert.strictEqual(
      this.clearedPollId,
      777,
      'polling stopped after terminal status',
    );
  });

  test('it renders backend job failure message', async function (assert) {
    registerSession(this.owner, {
      isAuthenticated: true,
      user: {
        is_admin: false,
        patreon_tier: {
          rate: 50,
        },
      },
    });

    this.fetchQueue.push(
      mockJsonResponse(202, {
        id: 'job-fail',
        status: 'queued',
        requested_hours: 2,
        status_url: '/api/audio-range-exports/job-fail',
      }),
      mockJsonResponse(200, {
        id: 'job-fail',
        status: 'failed',
        requested_hours: 2,
        processed_hours: 0,
        missing_hours: [],
        error: 'No recordings found in requested range.',
      }),
    );

    await render(hbs`<AudioRangeExport />`);

    await fillIn('[data-test-range-feed]', 'zone1');
    await fillIn('input[name="start_datetime"]', '2/5/2026 10:00 AM');
    await fillIn('input[name="end_datetime"]', '2/5/2026 12:00 PM');
    await click('[data-test-range-submit]');

    assert.dom('[data-test-range-job-status]').hasText('failed');
    assert
      .dom('[data-test-range-job-error]')
      .includesText('No recordings found in requested range.');
  });

  test('it validates max range and prevents API request', async function (assert) {
    registerSession(this.owner, {
      isAuthenticated: true,
      user: {
        is_admin: false,
        patreon_tier: {
          rate: 50,
        },
      },
    });

    await render(hbs`<AudioRangeExport />`);

    await fillIn('[data-test-range-feed]', 'zone1');
    await fillIn('input[name="start_datetime"]', '2/5/2026 10:00 AM');
    await fillIn('input[name="end_datetime"]', '2/6/2026 11:00 AM');
    await click('[data-test-range-submit]');

    assert
      .dom('[data-test-range-create-error]')
      .includesText('Time range must be 24 hours or less.');
    assert.strictEqual(
      this.fetchCalls.length,
      0,
      'no API call for invalid range',
    );
  });

  test('it validates encrypted cutover crossing and prevents API request', async function (assert) {
    registerSession(this.owner, {
      isAuthenticated: true,
      user: {
        is_admin: false,
        patreon_tier: {
          rate: 50,
        },
      },
    });

    await render(hbs`<AudioRangeExport />`);

    await fillIn('[data-test-range-feed]', 'zone1');
    await fillIn('input[name="start_datetime"]', '1/30/2023 5:00 AM');
    await fillIn('input[name="end_datetime"]', '1/30/2023 7:00 AM');
    await click('[data-test-range-submit]');

    assert
      .dom('[data-test-range-create-error]')
      .includesText('Please split it into two separate exports.');
    assert.strictEqual(
      this.fetchCalls.length,
      0,
      'no API call when cutover is crossed',
    );
  });
});
