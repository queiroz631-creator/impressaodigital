import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import * as portalFotos from "@/lib/foto-express-portal.functions";

// Customer functions enforce their independent HttpOnly session on the server.
export const attachStaffAuth = createMiddleware({ type: "function" }).client(
  async ({ next, serverFnMeta }) => {
    const customerPortal = Object.values(portalFotos).some(
      (fn) => fn.url.endsWith(serverFnMeta.id),
    );
    if (customerPortal) return next();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
