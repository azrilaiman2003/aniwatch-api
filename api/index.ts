import app from "../src/server.js";
import { handle } from "hono/vercel";
import { createClient } from '@supabase/supabase-js'

const handler = handle(app);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

app.get('/api/quotes', async (c) => {
  try {
    const { data, error } = await supabase
      .from('kartun')
      .select('*')
      .order('random()')
      .limit(1)
      .single()

    if (error) {
      throw error
    }

    return c.json(data)
  } catch (error) {
    console.error('Error fetching quote:', error)
    return c.json({ error: 'Failed to fetch quote' }, 500)
  }
})

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const OPTIONS = handler;
