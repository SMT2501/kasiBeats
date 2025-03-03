const { override } = require('customize-cra');

module.exports = override(
  (config) => {
    // Ignore source map warnings
    config.ignoreWarnings = [
      {
        module: /node_modules\/react-datepicker/,
        message: /Failed to parse source map/,
      },
    ];
    return config;
  }
);