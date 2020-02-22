// rewiremock.es6.js
import rewiremock, {plugins} from "rewiremock";
/// settings
rewiremock.overrideEntryPoint(module); // this is important
export { rewiremock };
