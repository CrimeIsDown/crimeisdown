import Component from '@glimmer/component';
import { action } from '@ember/object';
import $ from 'jquery';
import fetch from 'fetch';

export default class DirectivesList extends Component {
  constructor() {
    super(...arguments);

    fetch('https://directives.crimeisdown.com/diff_list.json').then(
      (response) => {
        let dateSorter = (a, b) => {
          a = new Date(a);
          b = new Date(b);
          if (a > b) {
            return 1;
          }
          if (a < b) {
            return -1;
          }
          return 0;
        };

        response.json().then((directives) => {
          window.$('#directives').bootstrapTable({
            columns: [
              {
                field: 'link',
                title: 'Directive Title',
                sortable: true,
                width: 40,
                widthUnit: '%',
              },
              {
                field: 'issue_date',
                title: 'Issue Date',
                sortable: true,
                sorter: dateSorter,
                width: 10,
                widthUnit: '%',
              },
              {
                field: 'effective_date',
                title: 'Effective Date',
                sortable: true,
                sorter: dateSorter,
                width: 10,
                widthUnit: '%',
              },
              {
                field: 'rescinds',
                title: 'Rescinds',
                sortable: true,
                width: 20,
                widthUnit: '%',
              },
              {
                field: 'index_category',
                title: 'Index Category',
                sortable: true,
                width: 20,
                widthUnit: '%',
              },
            ],
            data: directives,
            sortName: 'issue_date',
            sortOrder: 'desc',
            onPostBody: () => {
              $('#directives')
                .find('td > a')
                .click((event) => {
                  event.preventDefault();
                  this.openDirective(
                    $(event.currentTarget).attr('href'),
                    $(event.currentTarget).text()
                  );
                });

              $('#directiveViewer')
                .find('form input')
                .focus((event) => {
                  $(event.currentTarget).select();
                });

              $('#switch-diff-view').click((event) => {
                $('#primaryDiffView').toggle();
                $('#sideBySideView').toggle();
                $('.modal-dialog').toggleClass('modal-fullwidth');
              });

              if (window.location.hash) {
                let path = window.location.hash.substring(1);
                // Remove the hash
                history.pushState(
                  '',
                  document.title,
                  window.location.pathname + window.location.search
                );
                // Open the directive
                let title = $('#directives')
                  .find(
                    'td > a[href="https://directives.crimeisdown.com/diff/' +
                      path +
                      '"]'
                  )
                  .text();
                this.openDirective(
                  'https://directives.crimeisdown.com/diff/' + path,
                  title
                );
              }
            },
          });
        });
      }
    );
  }

  @action
  submitFindDirectiveForm(event) {
    event.preventDefault();
    let url = new URL(document.getElementById('url').value);
    let date = document.getElementById('date').value;
    window.location.assign(
      'https://directives.crimeisdown.com' + url.pathname + '?date=' + date
    );
  }

  openDirective(path, title) {
    let modal = $('#directiveViewer');
    modal.find(' h4.modal-title').text(title);
    modal.find('#directiveFrame').attr('src', path);
    window.$('#directiveViewer').modal();

    let url = new URL(path).pathname.replace('/diff/', '');
    modal
      .find('#no-highlights-btn')
      .attr('href', 'https://directives.crimeisdown.com/' + url);
    modal.find('input[type="text"]').val(window.location + '#' + url);

    let commit = url.substring(0, url.indexOf('/'));
    url = path.replace('diff/' + commit + '/', '') + '?commit=' + commit;
    modal.find('#oldVersion').attr('src', url + '^');
    modal.find('#newVersion').attr('src', url);

    if (window.ga && typeof window.ga === 'function') {
      ga('send', 'event', 'Directive', 'open', title);
    }
  }
}
