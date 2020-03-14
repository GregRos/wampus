import "source-map-support/browser-source-map-support";
declare const sourceMapSupport: any;
sourceMapSupport.install();

import "mocha-loader!./mocha-root";