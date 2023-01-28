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
  configure,
  currentRefinements,
  pagination,
  refinementList,
  searchBox,
  sortBy,
  stats,
} from 'instantsearch.js/es/widgets';
import { defaultTemplates as statsTemplates } from 'instantsearch.js/es/widgets/stats/stats';
import moment from 'moment-timezone';

export default class TranscriptSearchComponent extends Component {
  @service session;

  @tracked hasAccess = undefined;
  @tracked apiKey =
    'REDACTED_PUBLIC_CREDENTIAL';
  @tracked indexName = 'calls_demo';
  @tracked hits = [];
  @tracked useMediaPlayerComponent = false;
  @tracked autoRefreshInterval = '0';
  @tracked minStartTime;
  @tracked maxStartTime;
  autoRefresh = undefined;

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
  restartAutoRefresh() {
    clearInterval(this.autoRefresh);
    if (parseInt(this.autoRefreshInterval) > 0) {
      this.autoRefresh = setInterval(() => {
        this.search.refresh();
      }, parseInt(this.autoRefreshInterval) * 1000);
    }
  }

  processHit(hit) {
    hit._highlightResult.transcript.value = unescape(
      hit._highlightResult.transcript.value
    ).trim();

    const parsed_metadata = JSON.parse(hit.raw_metadata);
    hit.raw_metadata = JSON.stringify(parsed_metadata, null, 4);

    hit.audio_type = capitalize(hit.audio_type);

    let start_time = moment.unix(hit.start_time);
    if (hit.short_name == 'chi_cpd' && parsed_metadata['encrypted'] == 1) {
      hit.time_warning = ` - received at ${start_time
        .toDate()
        .toLocaleString()}`;
      start_time = start_time.subtract(30, 'minutes');
      hit.encrypted = true;
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

    hit.contextUrl = this.search.createURL(this.buildContextState(hit));
    return hit;
  }

  buildContextState(hit) {
    return {
      [this.indexName]: {
        sortBy:
          this.search.getUiState()[this.indexName].sortBy || this.defaultSort,
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
    this.search.setUiState(state);
    this.search.once('render', () => {
      const backgroundClass = 'bg-light';
      document
        .querySelectorAll('.ais-Hits-item')
        .forEach((elem) => elem.classList.remove(backgroundClass));
      const hitElement = document.getElementById(`hit-${hit.id}`);
      hitElement.classList.add(backgroundClass);
      const y =
        hitElement.getBoundingClientRect().top + window.pageYOffset - 60;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  }

  @action
  async setupSearch() {
    try {
      // For debugging
      let apiKey = localStorage.getItem('search-key');
      if (apiKey) {
        this.apiKey = apiKey;
        this.hasAccess = true;
        this.indexName = 'calls';
      }
    } catch (e) {
      // Do nothing, we don't have localStorage
    }
    if (this.hasAccess === undefined) {
      try {
        this.apiKey = await (
          await fetch('https://api.crimeisdown.com/api/search-key', {
            credentials: 'include',
          })
        ).text();
        this.hasAccess = true;
        this.indexName = 'calls';
      } catch {
        this.hasAccess = false;
      }
    }
    this.defaultSort = `${this.indexName}:start_time:desc`;

    const globalThis = this;

    const searchClient = new instantMeiliSearch(
      'https://api.crimeisdown.com/search',
      this.apiKey,
      {
        finitePagination: true,
      }
    );

    this.search = instantsearch({
      searchClient,
      indexName: this.indexName,
      routing: {
        router: history({
          windowTitle(routeState) {
            const indexState = routeState.calls || {};

            if (!indexState.query) {
              return 'Search Scanner Transcripts | CrimeIsDown.com';
            }

            return `${indexState.query} - Search Scanner Transcripts | CrimeIsDown.com`;
          },
          parseURL({ qsModule, location }) {
            const routeState = qsModule.parse(location.search.slice(1), {
              arrayLimit: 99,
            });
            if (routeState[globalThis.indexName] === undefined) {
              routeState[globalThis.indexName] = {};
            }
            if (routeState[globalThis.indexName]['sortBy'] === undefined) {
              routeState[globalThis.indexName]['sortBy'] =
                globalThis.defaultSort;
            }
            return routeState;
          },
        }),
      },
    });

    let timerId;

    this.search.addWidgets([
      searchBox({
        container: '#searchbox',
        queryHook(query, refine) {
          clearTimeout(timerId);
          timerId = setTimeout(() => refine(query), 300);
        },
      }),
      sortBy({
        container: '#sort-by',
        items: [
          { label: 'Newest First', value: this.defaultSort },
          { label: 'Oldest First', value: `${this.indexName}:start_time:asc` },
          {
            label: 'Relevance',
            value: this.indexName,
          },
        ],
      }),
      clearRefinements({
        container: '#clear-refinements',
        cssClasses: {
          button: ['mb-4'],
          disabledButton: ['d-none'],
        },
        templates: {
          resetLabel({ hasRefinements }, { html }) {
            return html`<span
              >${hasRefinements ? 'Clear filters' : 'No filters'}</span
            >`;
          },
        },
      }),
      currentRefinements({
        container: '#current-refinements',
        cssClasses: {
          list: 'input-group',
        },
        transformItems(items) {
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
                item.label = 'Radio ID';
                break;
              case 'start_time':
                item.label = 'Call Time';
                break;
            }
            return item;
          });
        },
      }),
      stats({
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
      }),
      connectHits((renderOptions) => {
        const { hits } = renderOptions;
        hits.map(this.processHit.bind(globalThis));
        this.hits = hits;
      })(),
      configure({
        hitsPerPage: 40,
      }),
      refinementList({
        container: '#dept-menu',
        attribute: 'talkgroup_group',
        operator: 'or',
        showMore: true,
        showMoreLimit: 60,
        cssClasses: {
          label: ['form-check-label'],
          checkbox: ['form-check-input'],
          item: ['form-check'],
          count: ['ms-1'],
        },
      }),
      refinementList({
        container: '#tg-menu',
        attribute: 'talkgroup_tag',
        operator: 'or',
        showMore: true,
        showMoreLimit: 60,
        cssClasses: {
          label: ['form-check-label'],
          checkbox: ['form-check-input'],
          item: ['form-check'],
          count: ['ms-1'],
        },
      }),
      refinementList({
        container: '#units-menu',
        attribute: 'units',
        operator: 'or',
        showMore: true,
        showMoreLimit: 60,
        cssClasses: {
          label: ['form-check-label'],
          checkbox: ['form-check-input'],
          item: ['form-check'],
          count: ['ms-1'],
        },
      }),
      refinementList({
        container: '#radios-menu',
        attribute: 'radios',
        operator: 'or',
        showMore: true,
        showMoreLimit: 60,
        cssClasses: {
          label: ['form-check-label'],
          checkbox: ['form-check-input'],
          item: ['form-check'],
          count: ['ms-1'],
        },
      }),
      refinementList({
        container: '#srclist-menu',
        attribute: 'srcList',
        operator: 'or',
        showMore: true,
        showMoreLimit: 60,
        cssClasses: {
          label: ['form-check-label'],
          checkbox: ['form-check-input'],
          item: ['form-check'],
          count: ['ms-1'],
        },
      }),
      connectRange((renderOptions, isFirstRender) => {
        const { start, refine } = renderOptions;
        const [min, max] = start;
        if (isFinite(min)) {
          globalThis.minStartTime = new Date(min * 1000);
        } else {
          globalThis.minStartTime = this.flatpickrOptions.minDefaultDate;
        }
        if (isFinite(max)) {
          globalThis.maxStartTime = new Date(max * 1000);
        } else {
          globalThis.maxStartTime = new Date();
        }
        if (isFirstRender) {
          globalThis.updateStartTimeFilter = refine;
        }
      })({
        container: '#time-input',
        attribute: 'start_time',
      }),
      pagination({
        container: '#pagination',
      }),
    ]);

    this.search.start();
  }
}
