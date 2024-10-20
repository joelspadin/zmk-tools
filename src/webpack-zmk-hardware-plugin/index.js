const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');
const yaml = require('yaml');

const ZMK_ROOT = 'zmk';

/**
 * Combines all *.zmk.yml files into an array and writes them to a new YAML file.
 */
class ZmkHardwarePlugin extends CopyPlugin {
    /**
     * @param {string} dest Output path
     */
    constructor(dest) {
        super({
            patterns: [
                {
                    from: 'zmk/app/boards/**/*.zmk.yml',
                    to: dest,
                    transformAll(assets) {
                        const hardware = assets.reduce((result, asset) => {
                            const item = yaml.parse(asset.data.toString());

                            item.directory = path.posix.relative(ZMK_ROOT, path.posix.dirname(asset.sourceFilename));

                            result.push(item);
                            return result;
                        }, []);

                        return JSON.stringify(hardware);
                    },
                },
            ],
        });
    }
}

module.exports = ZmkHardwarePlugin;
