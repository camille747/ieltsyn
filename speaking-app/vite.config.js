import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {localAiPlugin} from "../desktop/vite-ai-plugin.mjs";
export default defineConfig({cacheDir:"../node_modules/.vite-ielts-speaking",plugins:[react(),localAiPlugin()],server:{host:"127.0.0.1",port:5174,strictPort:true,watch:{usePolling:true,interval:750,ignored:["**/dist/**","**/work/**","**/shadowing/media/**","**/shadowing/sources/**"]}}});
