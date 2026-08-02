// Ambient declarations for Supabase Edge Functions when type-checked under the app's TS config.

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

declare module "npm:@supabase/supabase-js@2.43.2" {
  export function createClient(...args: any[]): any;
}
