import Component from '@glimmer/component';
import $ from 'jquery';
import fetch from 'fetch';

export default class DirectivesList extends Component {
  constructor() {
    super(...arguments);

    // Put this function on the window so bootstrapTable can use it
    window.openDirective = function (path, title) {
      var modal = window.$('#directiveViewer');
      modal.find('h4.modal-title').text(title);
      modal.find('#directiveFrame a').attr('href', path); // Needed in case the browser doesn't support iframes
      modal.find('#directiveFrame').attr('src', path);
      window.$('#directiveViewer').modal();
      modal.find('input[type="text"]').val(window.location + '#' + path.substring(40));
      if (window.ga && typeof window.ga === "function") {
        ga('send', 'event', 'Directive', 'open', title);
      }
    };

    fetch('https://directives.crimeisdown.com/diff_list.json').then((response) => {
      response.json().then((directives) => {
        window.$('#directives').bootstrapTable({
          columns: [{
            field: 'link',
            title: 'Directive Title',
            sortable: true,
            events: {
              'click a': function (e, value, row, index) {
                e.preventDefault()
                window.openDirective($(e.currentTarget).attr('href'), $(e.currentTarget).text());
              }
            }
          }, {
            field: 'issue_date',
            title: 'Issue Date',
            sortable: true,
            sorter: this.dateSorter
          }, {
            field: 'effective_date',
            title: 'Effective Date',
            sortable: true,
            sorter: this.dateSorter
          }, {
            field: 'rescinds',
            title: 'Rescinds',
            sortable: true
          }, {
            field: 'index_category',
            title: 'Index Category',
            sortable: true
          }],
          data: directives,
          sortName: 'issue_date',
          sortOrder: 'desc'
        });

        if (window.location.hash) {
          let path = window.location.hash.substring(1);
          // Remove the hash
          history.pushState("", document.title, window.location.pathname + window.location.search);
          // Open the directive
          let title = window.$('#directives').find('td > a[href="https://directives.crimeisdown.com/diff/' + path + '"]').text();
          window.openDirective('https://directives.crimeisdown.com/diff/' + path, title);
        }

        $('#directiveViewer').find('form input').focus((event) => {
          $(event.currentTarget).select();
        });
      });
    });
  }

  dateSorter(a, b) {
    a = new Date(a);
    b = new Date(b);
    if (a > b) {
      return 1;
    }
    if (a < b) {
      return -1;
    }
    return 0;
  }
}
