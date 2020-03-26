import Component from '@ember/component';
import $ from 'jquery';
import fetch from 'fetch';

export default Component.extend({
  actions: {
    submitFindDirectiveForm() {
      let url = new URL(document.getElementById('url').value);
      let date = document.getElementById('date').value;
      window.location.assign('https://directives.crimeisdown.com' + url.pathname + '?date=' + date);
    }
  },
  openDirective(path, title) {
    let modal = $('#directiveViewer');
    modal.find(' h4.modal-title').text(title);
    modal.find('#directiveFrame a').attr('href', path); // Needed in case the browser doesn't support iframes
    modal.find('#directiveFrame').attr('src', path);
    window.$('#directiveViewer').modal();
    let url = (new URL(path)).pathname.replace('/diff/', '');
    modal.find('#no-highlights-btn').attr('href', 'https://directives.crimeisdown.com/' + url);
    modal.find('input[type="text"]').val(window.location + '#' + url);
    if (window.ga && typeof window.ga === "function") {
      ga('send', 'event', 'Directive', 'open', title);
    }
  },
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
  },
  didRender() {
    this.table = $('#directives');

    fetch('https://directives.crimeisdown.com/diff_list.json').then((response) => {
      response.json().then((directives) => {
        window.$('#directives').bootstrapTable({
          columns: [{
            field: 'link',
            title: 'Directive Title',
            sortable: true,
            width: 40,
            widthUnit: '%'
          }, {
            field: 'issue_date',
            title: 'Issue Date',
            sortable: true,
            sorter: this.dateSorter,
            width: 10,
            widthUnit: '%'
          }, {
            field: 'effective_date',
            title: 'Effective Date',
            sortable: true,
            sorter: this.dateSorter,
            width: 10,
            widthUnit: '%'
          }, {
            field: 'rescinds',
            title: 'Rescinds',
            sortable: true,
            width: 20,
            widthUnit: '%'
          }, {
            field: 'index_category',
            title: 'Index Category',
            sortable: true,
            width: 20,
            widthUnit: '%'
          }],
          data: directives,
          sortName: 'issue_date',
          sortOrder: 'desc'
        });

        this.table.find('td > a').click((event) => {
          event.preventDefault();
          this.openDirective($(event.currentTarget).attr('href'), $(event.currentTarget).text());
        });

        if (window.location.hash) {
          let path = window.location.hash.substring(1);
          let title = this.table.find('td > a[href="https://directives.crimeisdown.com/diff/' + path + '"]').text();
          window.location.hash = '';
          this.openDirective('https://directives.crimeisdown.com/diff/' + path, title);
        }
      });
    });

    $('#directiveViewer').find('form input').focus((event) => {
      $(event.currentTarget).select();
      try {
        document.execCommand('copy');
      } catch (e) {
        alert('Your browser does not support automatic copying, please copy the text manually.');
      }
    });
  }
});
