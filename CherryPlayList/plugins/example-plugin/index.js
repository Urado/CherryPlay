/**
 * Example plugin for CherryPlayList
 * This is a minimal plugin structure
 */

module.exports = {
  name: 'example-plugin',
  version: '1.0.0',

  /**
   * Called when plugin is loaded
   */
  onLoad: function () {
    console.log('Example plugin loaded');
  },

  /**
   * Called when plugin is unloaded
   */
  onUnload: function () {
    console.log('Example plugin unloaded');
  },

  /**
   * Plugin API methods
   */
  api: {
    // Add custom methods here
  },
};
