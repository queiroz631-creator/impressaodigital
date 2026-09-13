import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const esquemaNovoUsuario = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.string().trim().email("E-mail inválido"),
  senha: z.string().min(6, "A senha precisa ter ao menos 6 caracteres"),
  perfilId: z.string().uuid().nullable().optional(),
});

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => esquemaNovoUsuario.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: erroRole } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (erroRole) throw new Error(erroRole.message);
    if (!isAdmin) throw new Error("Apenas administradores podem criar usuários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });

    let id = criado?.user?.id;
    let existente = false;

    if (error) {
      const duplicado = /already registered|already been registered|exists/i.test(error.message);
      if (!duplicado) throw new Error(error.message);

      // Conta já existe no login: reaproveita, atualiza a senha e religa o cadastro.
      const alvo = data.email.toLowerCase();
      let pagina = 1;
      while (!id && pagina <= 20) {
        const { data: lista, error: erroLista } = await supabaseAdmin.auth.admin.listUsers({
          page: pagina,
          perPage: 200,
        });
        if (erroLista) throw new Error(erroLista.message);
        id = lista.users.find((u) => (u.email ?? "").toLowerCase() === alvo)?.id;
        if (lista.users.length < 200) break;
        pagina += 1;
      }
      if (!id) throw new Error("Este e-mail já está em uso.");

      const { error: erroUpdate } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: data.senha,
        email_confirm: true,
        user_metadata: { nome: data.nome },
      });
      if (erroUpdate) throw new Error(erroUpdate.message);
      existente = true;
    }

    if (!id) throw new Error("Não foi possível criar o usuário.");


    const { error: erroPerfil } = await supabaseAdmin.from("profiles").upsert(
      {
        id,
        nome: data.nome,
        email: data.email,
        ativo: true,
        perfil_id: data.perfilId ?? null,
      },
      { onConflict: "id" },
    );
    if (erroPerfil) throw new Error(erroPerfil.message);

    return { id };
  });
