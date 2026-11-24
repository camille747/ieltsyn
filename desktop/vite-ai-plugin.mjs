import { createAiHandler } from "./ai-service.mjs";

export function localAiPlugin() {
  return {
    name: "private-local-ai",
    configureServer(server) {
      const handler = createAiHandler();
      server.middlewares.use((request, response, next) => {
        handler(request, response).then((handled) => { if (!handled) next(); }).catch(next);
      });
    },
  };
}
