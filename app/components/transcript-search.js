import { capitalize } from '@ember/string';
import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import instantsearch from 'instantsearch.js';
import { highlight } from 'instantsearch.js/es/helpers';
import {
  configure,
  currentRefinements,
  hits,
  pagination,
  rangeSlider,
  refinementList,
  searchBox,
  sortBy,
  stats,
} from 'instantsearch.js/es/widgets';
import { defaultTemplates as statsTemplates } from 'instantsearch.js/es/widgets/stats/stats';
import { history } from 'instantsearch.js/es/lib/routers';
import { instantMeiliSearch } from '@meilisearch/instant-meilisearch';

export default class TranscriptSearchComponent extends Component {
  @tracked hits = [];
  @tracked useMediaPlayerComponent = false;
  @tracked autoRefreshInterval = '0';
  autoRefresh = undefined;
  search = undefined;

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
  async setupSearch() {
    const response = await fetch('https://api.crimeisdown.com/api/search-key', {
      credentials: 'include',
    });
    const apiKey = await response.text();

    const searchClient = new instantMeiliSearch(
      'https://api.crimeisdown.com/search',
      apiKey,
      {
        finitePagination: true,
      }
    );

    const defaultSort = 'calls:start_time:desc';
    const minStartTime = Math.floor(new Date(2023, 0, 1).getTime() / 1000);
    const maxStartTime = Math.floor(
      new Date().setDate(new Date().getDate() + 1) / 1000
    );

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

            if (
              routeState[indexName].range.start_time ===
              `${minStartTime}:${maxStartTime}`
            ) {
              delete routeState[indexName].range.start_time;
            }

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

    const globalThis = this;

    this.search.addWidgets([
      searchBox({
        container: '#searchbox',
      }),
      sortBy({
        container: '#sort-by',
        items: [
          { label: 'Newest First', value: defaultSort },
          { label: 'Oldest First', value: 'calls:start_time:asc' },
          {
            label: 'Relevance',
            value: 'calls',
          },
        ],
      }),
      currentRefinements({
        container: '#current-refinements',
        excludedAttributes: ['start_time'],
        transformItems(items) {
          return items.map((item) => {
            switch (item.attribute) {
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
      hits({
        container: '#hits',
        escapeHTML: false,
        templates: {
          item(hit, { html }) {
            // TODO: add button to see call in context of transcripts
            return html`
              <div>
                <h4 title="${hit.talkgroup_description}">
                  ${hit.talkgroup_tag} - ${hit.talkgroup_group}
                </h4>
                <p>
                  <strong>
                    ${new Date(hit.start_time * 1000).toLocaleString()}
                  </strong>
                </p>
                <p>
                  <span class="badge bg-secondary me-1">
                    TG ${hit.talkgroup}
                  </span>
                  <span class="badge bg-secondary me-1">
                    ${hit.talkgroup_group_tag}
                  </span>
                  <span
                    class="badge ${hit.audio_type == 'digital'
                      ? 'bg-danger'
                      : 'bg-primary'} me-1"
                  >
                    ${capitalize(hit.audio_type)}
                  </span>
                  <span class="badge bg-secondary me-1">
                    Duration: ${hit.call_length}s
                  </span>
                  <button
                    class="badge btn btn-sm btn-info"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#metadata-${hit.id}"
                    aria-expanded="true"
                    aria-controls="metadata-${hit.id}"
                  >
                    Open Raw Metadata
                  </button>
                </p>
                <div class="collapse mt-3 mb-3" id="metadata-${hit.id}">
                  <pre>
                    ${JSON.stringify(JSON.parse(hit.raw_metadata), null, 4)}
                  </pre
                  >
                </div>
                <audio
                  id="videojs-player-${hit.id}"
                  class="${globalThis.useMediaPlayerComponent
                    ? 'video-js vjs-default-skin vjs-fill'
                    : 'call-audio'}"
                  src="${hit.raw_audio_url}"
                  controls
                  preload="none"
                ></audio>
                <p
                  dangerouslySetInnerHTML=${{
                    // We need to do this hacky thing to get the HTML from the transcript to render
                    __html: highlight({
                      attribute: 'transcript',
                      hit,
                    }),
                  }}
                ></p>
              </div>
            `;
          },
          empty(results, { html }) {
            return html`No results for <q>${results.query}</q>`;
          },
        },
        transformItems(items) {
          const transformedItems = items.map((item) => {
            item._highlightResult.transcript.value =
              item._highlightResult.transcript.value
                .trim()
                .replace(/\n/g, '<br/>')
                .replace(/__ais-highlight__/g, '<mark>')
                .replace(/__\/ais-highlight__/g, '</mark>');
            return item;
          });
          globalThis.hits = transformedItems;
          return transformedItems;
        },
      }),
      configure({
        hitsPerPage: 20,
      }),
      refinementList({
        container: '#tg-menu',
        attribute: 'talkgroup_tag',
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
        container: '#radioid-menu',
        attribute: 'srcList',
        showMore: true,
        showMoreLimit: 60,
        cssClasses: {
          label: ['form-check-label'],
          checkbox: ['form-check-input'],
          item: ['form-check'],
          count: ['ms-1'],
        },
        transformItems(items) {
          return items.filter(
            (item) => item.value !== '\\-1' && item.value !== '0'
          );
        },
      }),
      rangeSlider({
        container: '#time-slider',
        attribute: 'start_time',
        min: minStartTime,
        max: maxStartTime,
        pips: false,
        tooltips: {
          format: (value) =>
            new Date(value * 1000).toLocaleString([], {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
        },
        cssClasses: {
          tooltip: ['pt-5'],
        },
      }),
      pagination({
        container: '#pagination',
      }),
    ]);

    this.search.start();
  }
}
