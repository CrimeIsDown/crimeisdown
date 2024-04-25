import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import { service } from '@ember/service';

export default class AppHeader extends Component {
  @service config;
  @service session;
  @tracked playmusic = false;

  @action
  togglemusic() {
    set(this, 'playmusic', !this.playmusic);
    let audioElem = document.getElementById('copstheme');
    if (this.playmusic) {
      audioElem.volume = 0.3;
      audioElem.play();
    } else {
      audioElem.pause();
    }
  }

  /*!
   * Color mode toggler for Bootstrap's docs (https://getbootstrap.com/)
   * Copyright 2011-2022 The Bootstrap Authors
   * Licensed under the Creative Commons Attribution 3.0 Unported License.
   */
  @action
  initThemeToggle() {
    let storedTheme = null;
    try {
      storedTheme = localStorage.getItem('theme');
      // eslint-disable-next-line no-empty
    } catch {}

    const getPreferredTheme = () => {
      if (storedTheme) {
        return storedTheme;
      }

      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    };

    const setTheme = function (theme) {
      if (
        theme === 'auto' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      ) {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-bs-theme', theme);
      }
    };

    setTheme(getPreferredTheme());

    const showActiveTheme = (theme) => {
      const activeThemeIcon = document.querySelector('.theme-icon-active use');
      const btnToActive = document.querySelector(
        `[data-bs-theme-value="${theme}"]`,
      );
      const svgOfActiveBtn = btnToActive
        .querySelector('svg use')
        .getAttribute('href');

      document.querySelectorAll('[data-bs-theme-value]').forEach((element) => {
        element.classList.remove('active');
      });

      btnToActive.classList.add('active');
      activeThemeIcon.setAttribute('href', svgOfActiveBtn);
    };

    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (storedTheme !== 'light' || storedTheme !== 'dark') {
          setTheme(getPreferredTheme());
        }
      });

    showActiveTheme(getPreferredTheme());

    document.querySelectorAll('[data-bs-theme-value]').forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const theme = toggle.getAttribute('data-bs-theme-value');
        localStorage.setItem('theme', theme);
        setTheme(theme);
        showActiveTheme(theme);
      });
    });
  }
}
