import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uaslttmteblkbkmvcoys.supabase.co';
const supabaseKey = 'sb_publishable_Q_wa6dFe8whfHz_C0lmK9Q_DAT6P4IY';

export const supabase = createClient(supabaseUrl, supabaseKey);