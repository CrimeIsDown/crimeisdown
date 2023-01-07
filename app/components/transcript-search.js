import { capitalize } from '@ember/string';
import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import instantsearch from 'instantsearch.js';
import { highlight } from 'instantsearch.js/es/helpers';
import {
  configure,
  hits,
  pagination,
  rangeSlider,
  refinementList,
  searchBox,
  sortBy,
  stats,
} from 'instantsearch.js/es/widgets';
import { history } from 'instantsearch.js/es/lib/routers';
import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';

export default class TranscriptSearchComponent extends Component {
  @tracked hits = [];
  @tracked useMediaPlayerComponent = false;

  @action
  setupSearch() {
    const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
      server: {
        apiKey: 'REDACTED_PUBLIC_CREDENTIAL', // Be sure to use an API key that only allows searches, in production
        nodes: [
          {
            host: 'crimeisdown',
            port: '8108',
            protocol: 'http',
          },
        ],
      },
      // The following parameters are directly passed to Typesense's search API endpoint.
      //  So you can pass any parameters supported by the search endpoint below.
      //  queryBy is required.
      //  filterBy is managed and overridden by InstantSearch.js. To set it, you want to use one of the filter widgets like refinementList or use the `configure` widget.
      additionalSearchParameters: {
        query_by: 'transcript,srcList',
        sort_by: 'start_time:desc',
      },
    });
    const searchClient = typesenseInstantsearchAdapter.searchClient;

    const search = instantsearch({
      searchClient,
      indexName: 'calls',
      routing: {
        router: history({
          windowTitle(routeState) {
            const indexState = routeState.calls || {};

            if (!indexState.query) {
              return 'Search Scanner Transcripts | CrimeIsDown.com';
            }

            return `${indexState.query} - Search Scanner Transcripts | CrimeIsDown.com`;
          },
        }),
      },
    });

    const globalThis = this;

    search.addWidgets([
      searchBox({
        container: '#searchbox',
      }),
      sortBy({
        container: '#sort-by',
        items: [
          { label: 'Newest First', value: 'calls/sort/start_time:desc' },
          { label: 'Oldest First', value: 'calls/sort/start_time:asc' },
          {
            label: 'Relevance',
            value: 'calls/sort/_text_match:desc,start_time:desc',
          },
        ],
      }),
      stats({
        container: '#stats',
      }),
      hits({
        container: '#hits',
        escapeHTML: false,
        templates: {
          item(hit, { html }) {
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
                    Call Metadata
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
                    : ''}"
                  src="${hit.raw_audio_url}"
                  controls
                  preload="none"
                  style="height: 100px; width: 100%"
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
                .replace(/\n/g, '<br/>');
            for (const src of item._highlightResult.srcList) {
              if (src.value.includes('<mark>')) {
                const callsign = src.value.replace(/<\/?mark>/g, '');
                item._highlightResult.transcript.value =
                  item._highlightResult.transcript.value.replace(
                    new RegExp(callsign, 'g'),
                    src.value
                  );
              }
            }
            item.transcript = item.transcript.trim().replace(/\n/g, '<br/>');
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
        searchable: true,
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
        searchable: true,
        cssClasses: {
          label: ['form-check-label'],
          checkbox: ['form-check-input'],
          item: ['form-check'],
          count: ['ms-1'],
        },
      }),
      rangeSlider({
        container: '#time-slider',
        attribute: 'start_time',
        pips: false,
        tooltips: {
          format: (value) => new Date(value * 1000).toLocaleString(),
        },
        cssClasses: {
          tooltip: ['pt-5'],
        },
      }),
      pagination({
        container: '#pagination',
      }),
    ]);

    search.start();

    if (search.getUiState().calls.sortBy === undefined) {
      search.setUiState({
        calls: {
          sortBy: 'calls/sort/start_time:desc',
        },
      });
    }
  }
}
