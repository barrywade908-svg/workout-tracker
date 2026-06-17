import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uaslttmteblkbkmvcoys.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhc2x0dG10ZWJsa2JrbXZjb3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTc3MDQsImV4cCI6MjA5NjM5MzcwNH0.I2cUmj8u9x4eTHZ-sx9NDtIvor6cDm73_YVvqOM7Dng';

export const supabase = createClient(supabaseUrl, supabaseKey);