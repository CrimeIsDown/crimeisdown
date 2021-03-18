import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class AppFooter extends Component {
  @tracked currentYear = new Date().getFullYear();
}
