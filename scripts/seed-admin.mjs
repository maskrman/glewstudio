import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_SEED_PASSWORD;

async function findUserByEmail(client, targetEmail) {
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`No se pudieron consultar usuarios: ${error.message}`);

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === targetEmail);
    if (user) return user;
    if (data.users.length < perPage) return null;
  }
}

async function seedAdmin() {
  if (!supabaseUrl || !serviceRoleKey || !email || !password) {
    throw new Error(
      'Configura NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SEED_EMAIL y ADMIN_SEED_PASSWORD.'
    );
  }
  if (password.length < 16) {
    throw new Error('ADMIN_SEED_PASSWORD debe tener al menos 16 caracteres.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const existingUser = await findUserByEmail(supabase, email);

  if (existingUser) {
    const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      app_metadata: { ...existingUser.app_metadata, role: 'admin' },
    });
    if (error) throw new Error(`No se pudo actualizar el administrador: ${error.message}`);
  } else {
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'admin' },
    });
    if (error) throw new Error(`No se pudo crear el administrador: ${error.message}`);
  }

  console.log(`Cuenta administradora lista: ${email}`);
}

seedAdmin().catch((error) => {
  console.error('[admin:seed]', error instanceof Error ? error.message : 'Error inesperado.');
  process.exitCode = 1;
});
