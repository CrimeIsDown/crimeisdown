import { action, set } from '@ember/object';
import { service } from '@ember/service';
import { capitalize } from '@ember/string';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { instantMeiliSearch } from '@meilisearch/instant-meilisearch';
import instantsearch from 'instantsearch.js';
import connectRange from 'instantsearch.js/es/connectors/range/connectRange';
import connectHits from 'instantsearch.js/es/connectors/hits/connectHits';
import { unescape } from 'instantsearch.js/es/lib/utils';
import { history } from 'instantsearch.js/es/lib/routers';
import {
  configure,
  clearRefinements,
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
  @tracked apiKey = undefined;
  @tracked indexName = 'calls';
  @tracked hits = [];
  @tracked useMediaPlayerComponent = false;
  @tracked autoRefreshInterval = '0';
  @tracked minStartTime;
  @tracked maxStartTime;
  autoRefresh = undefined;
  search = undefined;

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

  @action
  async login() {
    try {
      // For debugging
      let apiKey = localStorage.getItem('search-key');
      if (apiKey) {
        this.apiKey = apiKey;
        this.hasAccess = true;
        return;
      }
    } catch (e) {
      // Do nothing, we don't have localStorage
    }
    try {
      this.apiKey = await (
        await fetch('https://api.crimeisdown.com/api/search-key', {
          credentials: 'include',
        })
      ).text();
      this.hasAccess = true;
    } catch (e) {
      console.error(e);
      this.hasAccess = false;
      this.apiKey =
        'REDACTED_PUBLIC_CREDENTIAL';
      this.indexName = 'calls_demo';
    }
  }

  processHit(hit) {
    hit._highlightResult.transcript.value = unescape(
      hit._highlightResult.transcript.value
    )
      .trim()
      .replace(/\n/g, '<br/>');
    hit.audio_type = capitalize(hit.audio_type);
    const start_time = moment.unix(hit.start_time);
    let time_warning = '';
    if (
      hit.short_name == 'chi_cpd' &&
      hit.raw_metadata.includes('"encrypted": 1,')
    ) {
      const original_time = start_time.clone().subtract(30, 'minutes');
      time_warning = ` - encrypted broadcast approx. ${original_time
        .toDate()
        .toLocaleString()}`;
    }
    hit.time_warning = time_warning;
    hit.start_time_string = start_time.toDate().toLocaleString();
    hit.relative_time = start_time.fromNow();
    hit.raw_metadata = JSON.stringify(JSON.parse(hit.raw_metadata), null, 4);
    return hit;
  }

  @action
  async setupSearch() {
    const globalThis = this;

    const searchClient = new instantMeiliSearch(
      'https://api.crimeisdown.com/search',
      this.apiKey,
      {
        finitePagination: true,
      }
    );

    const defaultSort = `${this.indexName}:start_time:desc`;

    this.search = instantsearch({
      searchClient,
      indexName: defaultSort,
      routing: {
        router: history({
          windowTitle(routeState) {
            const indexState = routeState.calls || {};

            if (!indexState.query) {
              return 'Search Scanner Transcripts | CrimeIsDown.com';
            }

            return `${indexState.query} - Search Scanner Transcripts | CrimeIsDown.com`;
          },
          createURL({ qsModule, location, routeState }) {
            const { origin, pathname, hash } = location;
            const indexState = routeState['instant_search'] || {};
            // Remove the sort suffix from the index name
            const indexName = defaultSort.split(':')[0];
            delete Object.assign(routeState, {
              [indexName]: routeState[defaultSort],
            })[defaultSort];

            const queryString = qsModule.stringify(routeState);

            if (
              !indexState.query &&
              routeState[indexName].sortBy === defaultSort
            ) {
              return `${origin}${pathname}${hash}`;
            }

            return `${origin}${pathname}?${queryString}${hash}`;
          },
          parseURL({ qsModule, location }) {
            const routeState = qsModule.parse(location.search.slice(1), {
              arrayLimit: 99,
            });
            // Re-add the sort suffix to the index name
            const indexName = defaultSort.split(':')[0];
            if (indexName in routeState) {
              delete Object.assign(routeState, {
                [defaultSort]: routeState[indexName],
              })[indexName];
            }
            return routeState;
          },
        }),
      },
    });

    this.search.addWidgets([
      searchBox({
        container: '#searchbox',
      }),
      sortBy({
        container: '#sort-by',
        items: [
          { label: 'Newest First', value: defaultSort },
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
        hits.map(this.processHit);
        this.hits = hits;
      })(),
      configure({
        hitsPerPage: 20,
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
