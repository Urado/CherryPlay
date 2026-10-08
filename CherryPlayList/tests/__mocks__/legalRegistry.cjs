const fs = require('fs');
const path = require('path');

module.exports = {
  default: JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../CherryPlayComponents/src/constants/legal-registry.generated.json',
      ),
      'utf8',
    ),
  ),
};
