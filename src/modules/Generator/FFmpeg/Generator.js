import Event from '@/modules/Event';
import getImageSize from '../../Util/getImageSize';

/**
 * @typedef ConstructOptions
 * @property {string} corePath
 * @property {boolean} log
 */
class FFmpegGenerator extends Event {
  /**
   * @param {ConstructOptions} options
   */
  constructor(options) {
    super();

    /**
     * @type {any}
     */
    this.zip = null;

    /**
     * @type {string}
     */
    this.mimeType = '';

    /**
     * @type {any[]}
     */
    this.frames = [];

    /**
     * @type {number}
     */
    this.width = 0;

    /**
     * @type {number}
     */
    this.height = 0;

    /**
     * @type {number}
     */
    this.frameRate = 25;

    /**
     * @type {string[]}
     */
    this.loadedFiles = [];

    /**
     * @type {any} FFmpeg
     */
    this.ffmpeg = FFmpeg.createFFmpeg({
      corePath: options.corePath,
      // log: options.log
    });

    this.ffmpeg.setProgress(this.handleProgress.bind(this));
  }

  init() {
    return this.ffmpeg.load();
  }

  /**
   *
   * @param {any} zip
   * @param {string} mimeType
   * @param {any[]} frames
   */
  prepareGenerator(zip, mimeType, frames) {
    this.zip = zip;
    this.mimeType = mimeType;
    this.frames = frames;

    let time = 0;

    frames.forEach(frame => {
      time += frame.delay;
    });
    this.frameRate = Math.round(frames.length / time * 100000) / 100;

    return new Promise(resolve => {
      this.getSize().then(({width, height}) => {
        this.width = width;
        this.height = height;

        resolve(this);
      });
    });
  }

  /**
   * @param {{number}} params
   */
  handleProgress({ ratio }) {
    this.dispatch('progress', [ratio]);
  }

  /**
   * Get target size from the first file in zip file
   * @returns {Promise.<{width: number, height: number}>}
   */
  getSize() {
    return this.zip.file(this.frames[0].file).async('base64').then(base64 => {
      let imageBase64 = "data:" + this.mimeType + ';base64,' + base64;

      return getImageSize(imageBase64);
    });
  }

  /**
   *
   * @param {number} index
   * @returns {string}
   */
  getFrameFilename(index) {
    let indexStr = index + '';

    return '0'.repeat(6 - indexStr.length) + index;
  }

  loadFrames(index = 0) {
    return new Promise(resolve => {
      if (this.frames[index] === undefined) {
        resolve();
      } else {
        return this.zip.file(this.frames[index].file).async('uint8array').then(data => {
          let filename = this.getFrameFilename(index) + '.jpg';
          this.loadedFiles.push(filename);
          this.ffmpeg.FS('writeFile', filename, data);
          resolve(this.loadFrames(++index));
        });
      }
    });
  }

  /**
   * @param {any[]} args
   */
  runFFmpeg(...args) {
    args = args.map(arg => arg + '');

    return this.ffmpeg.run.apply(this.ffmpeg, args);
  }

  destroy() {
    try {
      this.ffmpeg.exit();
    } catch (e) {
      console.error(e);
    }
  }
}

export default FFmpegGenerator;
