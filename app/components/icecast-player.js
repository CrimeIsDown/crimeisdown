import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class IcecastPlayerComponent extends Component {
  @action
  initializePlayer(stream) {
    const audioElement = document.getElementById('icecast-audio');
    const metadataEl = document.getElementById('icecast-metadata');

    const onMetadata = (metadata) => {
      metadataEl.innerHTML = `<strong>Now Playing:</strong> ${metadata['StreamTitle']}`;
    };

    new IcecastMetadataPlayer(stream, {
      audioElement, //                  audio element in HTML
      onMetadata, //                    called when metadata is synced with the audio
      metadataTypes: ['icy'], //        detect ICY metadata
      icyDetectionTimeout: 5000, //     attempt to detect ICY metadata for 5 seconds
      enableLogging: true, //           enable error logs to the console
      onError: (message) => {
        metadataEl.innerHTML = message;
      },
    });
  }
}
