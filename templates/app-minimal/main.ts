/**
 * Point d'entrée minimal. Remplacera bientôt une intégration Hono complète.
 */

import { serve } from "jsr:@std/http@1.0.0/server";

serve((_req) => new Response("TSera template en cours de construction"));
