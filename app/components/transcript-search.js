import { action, set } from '@ember/object';
import { service } from '@ember/service';
import { capitalize } from '@ember/string';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { instantMeiliSearch } from '@meilisearch/instant-meilisearch';
import instantsearch from 'instantsearch.js';
import connectHits from 'instantsearch.js/es/connectors/hits/connectHits';
import connectRange from 'instantsearch.js/es/connectors/range/connectRange';
import { history } from 'instantsearch.js/es/lib/routers';
import { unescape } from 'instantsearch.js/es/lib/utils';
import {
  clearRefinements,
  currentRefinements,
  hitsPerPage,
  pagination,
  refinementList,
  searchBox,
  sortBy,
  stats,
} from 'instantsearch.js/es/widgets';
import { defaultTemplates as statsTemplates } from 'instantsearch.js/es/widgets/stats/stats';
import moment from 'moment-timezone';

export default class TranscriptSearchComponent extends Component {
  @service config;
  @service metrics;
  @service session;

  @tracked hasAccess = undefined;
  @tracked apiKey =
    'REDACTED_PUBLIC_CREDENTIAL';
  @tracked indexName = this.demoIndexName;
  @tracked hits = [];
  @tracked selectedHit = null;
  @tracked useMediaPlayerComponent =
    // Check if we are at the lg Bootstrap breakpoint
    window.matchMedia('(min-width: 992px)').matches;
  @tracked autoRefreshInterval = 0;
  @tracked minStartTime;
  @tracked maxStartTime;
  @tracked currentSearch;
  demoIndexName = 'calls_demo';
  paidIndexName = 'calls';
  autoRefresh = undefined;
  scrollTimer;

  constructor() {
    super(...arguments);
    this.minStartTime = moment().subtract(1, 'day').toDate();
    this.maxStartTime = new Date();
    this.flatpickrOptions = {
      enableTime: true,
      altFormat: 'n/j/Y h:i K',
      altInput: true,
      dateFormat: 'U',
      minDefaultDate: new Date(this.minStartTime.getTime()),
      maxDefaultDate: new Date(this.maxStartTime.getTime()),
    };
    if (window.location.hash.startsWith('#hit-')) {
      this.selectedHit = window.location.hash.split('#hit-')[1];
    }
  }

  @action
  setStartTimeRange(selectedDates, dateStr, instance) {
    set(this, instance.input.name, selectedDates[0]);
    let min = this.minStartTime.getTime();
    min =
      min === this.flatpickrOptions.minDefaultDate.getTime()
        ? undefined
        : Math.floor(min / 1000);
    let max = this.maxStartTime.getTime();
    max =
      max === this.flatpickrOptions.maxDefaultDate.getTime()
        ? undefined
        : Math.floor(max / 1000);
    this.updateStartTimeFilter([min, max]);
  }

  @action
  refresh(event) {
    event.target.classList.add('spin');
    this.search.refresh();
    setTimeout(() => {
      event.target.classList.remove('spin');
    }, 1000);
  }

  @action
  toggleAutoRefresh() {
    clearInterval(this.autoRefresh);
    this.autoRefreshInterval = this.autoRefreshInterval ? 0 : 10;
    if (this.autoRefreshInterval > 0) {
      this.search.refresh();
      this.autoRefresh = setInterval(() => {
        this.search.refresh();
      }, this.autoRefreshInterval * 1000);
    }
  }

  processHit(hit) {
    hit.raw_metadata = JSON.parse(hit.raw_metadata);
    hit.raw_transcript = JSON.parse(hit.raw_transcript);
    const hitClone = { ...hit };
    delete hitClone['_highlightResult'];
    delete hitClone['_snippetResult'];
    delete hitClone['__position'];
    delete hitClone['raw_metadata'];

    hit.json = JSON.stringify(hitClone, null, 2);

    hit._highlightResult.transcript.value = unescape(
      hit._highlightResult.transcript.value
    ).trim();

    try {
      hit.highlighted_transcript = JSON.parse(
        unescape(hit._highlightResult.raw_transcript.value)
      );
    } catch (e) {
      console.log(e);
      hit.highlighted_transcript = hit.raw_transcript;
    }

    // Apply highlights
    for (let i = 0; i < hit.raw_transcript.length; i++) {
      const segment = hit.raw_transcript[i];
      const highlightedSegment = hit.highlighted_transcript[i];
      const src = segment[0];
      if (src) {
        src.filter_link = this.getSrcFilterLink(src);
        src.label =
          highlightedSegment[0].tag.length > 0
            ? highlightedSegment[0].tag
            : String(src.src);
      }
      segment[1] = highlightedSegment[1];
    }

    if (hit.audio_type == 'digital tdma') {
      hit.audio_type = 'digital';
    }
    hit.audio_type = capitalize(hit.audio_type);

    switch (hit.talkgroup_group_tag) {
      case 'Law Dispatch':
      case 'Law Tac':
      case 'Law Talk':
      case 'Security':
        hit.talkgroup_group_tag_color = 'primary';
        break;
      case 'Fire Dispatch':
      case 'Fire-Tac':
      case 'Fire-Talk':
      case 'EMS Dispatch':
      case 'EMS-Tac':
      case 'EMS-Talk':
        hit.talkgroup_group_tag_color = 'danger';
        break;
      case 'Public Works':
      case 'Utilities':
        hit.talkgroup_group_tag_color = 'success';
        break;
      case 'Multi-Tac':
      case 'Emergency Ops':
        hit.talkgroup_group_tag_color = 'warning';
        break;
      default:
        hit.talkgroup_group_tag_color = 'secondary';
    }

    let start_time = moment.unix(hit.start_time);
    if (hit.short_name == 'chi_cpd') {
      if (hit.raw_metadata['encrypted'] == 1) {
        hit.time_warning = ` - received at ${start_time
          .toDate()
          .toLocaleString()}`;
        start_time = start_time.subtract(30, 'minutes');
        hit.encrypted = true;
      }
    }
    hit.start_time_string = start_time.toDate().toLocaleString();
    hit.relative_time = start_time.fromNow();

    hit.permalink = this.search.createURL({
      [this.indexName]: {
        refinementList: {
          talkgroup_tag: [hit.talkgroup_tag],
        },
        range: {
          start_time: `${hit.start_time}:${hit.start_time}`,
        },
      },
    });

    hit.contextUrl =
      this.search.createURL(this.buildContextState(hit)).split('#')[0] +
      '#hit-' +
      hit.id;

    if (this.hits) {
      const existingHit = this.hits.filter(
        (existingHit) => existingHit.id === hit.id
      )[0];
      if (existingHit) {
        hit.showPlayer = existingHit.showPlayer || false;
      }
    }

    return hit;
  }

  buildContextState(hit) {
    let sortBy = this.defaultSort;
    if (
      this.search.getUiState()[this.indexName] &&
      this.search.getUiState()[this.indexName]['sortBy']
    ) {
      sortBy = this.search.getUiState()[this.indexName]['sortBy'];
    }
    return {
      [this.indexName]: {
        sortBy,
        hitsPerPage: 60,
        refinementList: {
          talkgroup_tag: [hit.talkgroup_tag],
        },
        range: {
          start_time: [hit.start_time - 60 * 20, hit.start_time + 60 * 10].join(
            ':'
          ),
        },
      },
    };
  }

  @action
  getContext(hit, event) {
    event.preventDefault();
    const state = this.buildContextState(hit);
    this.selectedHit = hit.id;
    this.search.setUiState(state);
  }

  @action
  didInsertHit() {
    if (this.selectedHit) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        const elementId = `hit-${this.selectedHit}`;
        const hitElement = document.getElementById(elementId);
        if (hitElement) {
          const y =
            hitElement.getBoundingClientRect().top + window.pageYOffset - 60;
          window.scrollTo({ top: y, behavior: 'smooth' });

          const oldhash = window.location.hash;
          const newhash = '#' + elementId;
          if (oldhash != newhash) {
            window.history.pushState(window.history.state, '', newhash);
          }
        }
      }, 100);
    }
  }

  @action
  playAudio(hit) {
    set(hit, 'showPlayer', true);
  }

  buildSrcFilter(src) {
    let sortBy = this.defaultSort;
    let hitsPerPage = 20;
    if (
      this.search.getUiState()[this.indexName] &&
      this.search.getUiState()[this.indexName]['sortBy']
    ) {
      sortBy = this.search.getUiState()[this.indexName]['sortBy'];
    }
    if (
      this.search.getUiState()[this.indexName] &&
      this.search.getUiState()[this.indexName]['hitsPerPage']
    ) {
      hitsPerPage = this.search.getUiState()[this.indexName]['hitsPerPage'];
    }
    const uiState = {
      [this.indexName]: {
        sortBy,
        hitsPerPage,
        refinementList: {},
      },
    };
    if (src.tag) {
      uiState[this.indexName].refinementList['units'] = [src.tag];
    } else {
      uiState[this.indexName].refinementList['radios'] = [src.src];
    }
    return uiState;
  }

  @action
  getSrcFilterLink(src) {
    return this.search.createURL(this.buildSrcFilter(src));
  }

  @action
  filterSrc(src, hit, event) {
    event.preventDefault();
    const state = this.buildSrcFilter(src);
    this.selectedHit = hit.id;
    this.search.setUiState(state);
  }

  async login() {
    const loggedIn = await this.session.authenticated;
    try {
      this.apiKey = await this.session.getSearchAPIKey();
      this.indexName =
        this.config.get('MEILISEARCH_INDEX') || this.paidIndexName;
      this.hasAccess = true;
    } catch (e) {
      if (loggedIn) {
        console.error(e);
        alert(
          `Could not load search, please try again or check that you are at the right Patreon tier.\nGot error: ${
            e.message || e
          }`
        );
      }
      this.hasAccess = false;

      const generateWatermark = (name) => {
        return `<svg xmlns='http://www.w3.org/2000/svg' version='1.1' height='200px' width='200px'><text transform='translate(20, 100) rotate(-30)' fill='rgba(45,45,45,0.08)' font-size='32' font-family='Arial, Helvetica, sans-serif'>${name}</text></svg>`;
      };

      const base64Mark = btoa(generateWatermark('DEMO'));

      document.querySelector(
        '#hits'
      ).style.background = `url("data:image/svg+xml;base64,${base64Mark}") repeat`;
    }
  }

  @action
  async setupSearch() {
    await this.login();

    this.defaultSort = `${this.indexName}:start_time:desc`;
    this.defaultRouteState = {
      [this.indexName]: {
        sortBy: this.defaultSort,
      },
    };
    if (this.indexName !== this.demoIndexName) {
      this.defaultRouteState[this.indexName].range = {
        start_time:
          Math.floor(this.flatpickrOptions.minDefaultDate.getTime() / 1000) +
          ':',
      };
    }

    const searchClient = new instantMeiliSearch(
      this.config.get('MEILISEARCH_URL'),
      this.apiKey,
      {
        finitePagination: true,
      }
    );

    this.search = instantsearch({
      searchClient,
      indexName: this.indexName,
      routing: {
        router: this.getSearchRouter(),
      },
    });

    this.search.on('render', () => {
      const body = document.querySelector('body.ember-application');
      const container = document.querySelector(
        'body > div.container, body > div.container-fluid'
      );
      if (
        this.search.status === 'loading' ||
        this.search.status === 'stalled'
      ) {
        body.classList.add('show-loading');
        if (container) {
          container.classList.add('opacity-75');
        }
      } else {
        if (container) {
          container.classList.remove('opacity-75');
        }
        body.classList.remove('show-loading');
        this.metrics.trackEvent({
          category: 'Transcript',
          action: 'Performed search',
          label: JSON.stringify(this.search.getUiState()),
        });
      }
      const uiState = { ...this.search.getUiState()[this.indexName] };
      delete uiState['range'];
      delete uiState['sortBy'];
      this.currentSearch = uiState;
    });

    const sidebarWidgets = [
      this.getClearRefinementsWidget(),
      this.getRefinementListWidget('#system-menu', 'short_name'),
      this.getRefinementListWidget('#dept-menu', 'talkgroup_group'),
      this.getRefinementListWidget('#tg-menu', 'talkgroup_tag'),
      this.getRefinementListWidget('#tg-type-menu', 'talkgroup_group_tag'),
      this.getRefinementListWidget('#units-menu', 'units'),
      this.getRefinementListWidget('#radios-menu', 'radios'),
      this.getRefinementListWidget('#srclist-menu', 'srcList'),
      this.getStartTimeRangeWidget(),
    ];

    const mainWidgets = [
      this.getSearchBoxWidget(),
      this.getSortByWidget(),
      this.getCurrentRefinementsWidget(),
      this.getStatsWidget(),
      this.getHitsWidget(),
      this.getPaginationWidget(),
      this.getHitsPerPageWidget(),
    ];

    this.search.addWidgets(mainWidgets.concat(sidebarWidgets));

    this.search.start();

    return this.search;
  }

  @action
  resetFilters() {
    this.search.setUiState(this.defaultRouteState);
  }

  @action
  setChicagoFilters() {
    // Deep copy the default state
    const uiState = JSON.parse(JSON.stringify(this.defaultRouteState));
    uiState[this.indexName]['refinementList'] = {
      short_name: ['chi_cpd', 'chi_cfd', 'chi_oemc'],
    };
    this.search.setUiState(uiState);
  }

  getSearchRouter() {
    const windowTitle = (routeState) => {
      const indexState = routeState.calls || {};

      if (!indexState.query) {
        return 'Search Scanner Transcripts | CrimeIsDown.com';
      }

      return `${indexState.query} - Search Scanner Transcripts | CrimeIsDown.com`;
    };
    const parseURL = ({ qsModule, location }) => {
      const routeState = qsModule.parse(location.search.slice(1), {
        arrayLimit: 99,
      });
      if (!Object.keys(routeState).length) {
        return this.defaultRouteState;
      }
      if (routeState[this.demoIndexName] && this.hasAccess) {
        delete Object.assign(routeState, {
          [this.indexName]: routeState[this.demoIndexName],
        })[this.demoIndexName];
      }
      return routeState;
    };
    return history({
      windowTitle,
      parseURL,
    });
  }

  getSearchBoxWidget() {
    let timerId;
    return searchBox({
      container: '#searchbox',
      cssClasses: {
        input: 'form-control',
      },
      queryHook(query, refine) {
        clearTimeout(timerId);
        timerId = setTimeout(() => refine(query), 500);
      },
    });
  }

  getSortByWidget() {
    return sortBy({
      container: '#sort-by',
      cssClasses: {
        select: 'form-select',
      },
      items: [
        { label: 'Newest First', value: this.defaultSort },
        { label: 'Oldest First', value: `${this.indexName}:start_time:asc` },
        {
          label: 'Relevance',
          value: this.indexName,
        },
      ],
    });
  }

  getHitsPerPageWidget() {
    return hitsPerPage({
      container: '#hits-per-page',
      cssClasses: {
        select: 'form-select',
      },
      items: [
        { label: '20 per page', value: 20, default: true },
        { label: '40 per page', value: 40 },
        { label: '60 per page', value: 60 },
      ],
    });
  }

  getClearRefinementsWidget() {
    return clearRefinements({
      container: '#clear-refinements',
      templates: {
        resetLabel({ hasRefinements }, { html }) {
          return html`<span
            >${hasRefinements ? 'Clear filters' : 'No filters'}</span
          >`;
        },
      },
    });
  }

  getCurrentRefinementsWidget() {
    const transformItems = (items) => {
      return items.map((item) => {
        if (item.attribute == 'start_time') {
          for (const refinement of item.refinements) {
            refinement.label = refinement.label.replace(
              refinement.value,
              new Date(refinement.value * 1000).toLocaleString([], {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            );
          }
        }
        switch (item.attribute) {
          case 'short_name':
            item.label = 'System';
            break;
          case 'talkgroup_group':
            item.label = 'Department';
            break;
          case 'talkgroup_tag':
            item.label = 'Talkgroup';
            break;
          case 'srcList':
            item.label = 'Sources';
            break;
          case 'start_time':
            item.label = 'Call Time';
            break;
        }
        return item;
      });
    };
    return currentRefinements({
      container: '#current-refinements',
      cssClasses: {
        list: 'd-block',
        item: 'me-2',
      },
      transformItems,
    });
  }

  getStatsWidget() {
    return stats({
      container: '#stats',
      templates: {
        text: function text(props) {
          let text = statsTemplates.text(props);
          if (props.hasManyResults && props.nbHits === 1000) {
            text = `&ge;${text}`;
          }
          return text;
        },
      },
    });
  }

  getHitsWidget() {
    const render = (renderOptions) => {
      const { hits } = renderOptions;
      hits.map(this.processHit.bind(this));
      this.hits = hits;
    };
    return connectHits(render)();
  }

  getRefinementListWidget(container, attribute) {
    return refinementList({
      container,
      attribute,
      operator: 'or',
      showMore: true,
      showMoreLimit: 60,
      cssClasses: {
        label: ['form-check-label'],
        checkbox: ['form-check-input'],
        item: ['form-check'],
        count: ['ms-1'],
      },
    });
  }

  getStartTimeRangeWidget() {
    const render = (renderOptions, isFirstRender) => {
      const { start, refine } = renderOptions;
      const [min, max] = start;
      if (isFinite(min)) {
        this.minStartTime = new Date(min * 1000);
      } else {
        this.minStartTime = this.flatpickrOptions.minDefaultDate;
      }
      if (isFinite(max)) {
        this.maxStartTime = new Date(max * 1000);
      } else {
        this.maxStartTime = new Date();
      }
      if (isFirstRender) {
        this.updateStartTimeFilter = refine;
      }
    };
    return connectRange(render.bind(this))({
      container: '#time-input',
      attribute: 'start_time',
    });
  }

  getPaginationWidget() {
    return pagination({
      container: '#pagination',
    });
  }
}
