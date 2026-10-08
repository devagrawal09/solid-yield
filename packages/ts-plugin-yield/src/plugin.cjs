const { createVirtualService } = require("./service.cjs");
module.exports = function init({ typescript: ts }) {
  return {
    create(info) {
      let service = createVirtualService(ts, info.languageServiceHost, info.config);
      const proxy = Object.create(null);
      for (const k of Object.keys(info.languageService)) {
        const value = info.languageService[k];
        proxy[k] = typeof value === "function" ? value.bind(info.languageService) : value;
      }
      proxy.getSemanticDiagnostics = f => service.diagnostics(f);
      proxy.getSyntacticDiagnostics = f => service.diagnostics(f, "syntactic");
      proxy.getSuggestionDiagnostics = f => service.diagnostics(f, "suggestion");
      proxy.getQuickInfoAtPosition = (f, p) => service.quickInfo(f, p);
      proxy.dispose = () => {
        service.dispose();
        info.languageService.dispose();
      };
      return proxy;
    }
  };
};
