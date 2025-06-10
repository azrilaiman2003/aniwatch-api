import { Hono } from "hono";
import { createClient } from '@supabase/supabase-js'
import type { ServerContext } from "../config/context.js";

const quotesRouter = new Hono<ServerContext>();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

// /api/v2/quotes - Get quotes with optional search parameters
quotesRouter.get("/", async (c) => {
  try {
    const character = c.req.query('character');
    const anime = c.req.query('anime');
    const single = c.req.query('single') === 'true';

    let query = supabase
      .from('kartun')
      .select('id, anime, character, quote');

    // If search parameters are provided, use them
    if (character || anime) {
      if (character) {
        query = query.ilike('character', `%${character}%`);
      }
      if (anime) {
        query = query.ilike('anime', `%${anime}%`);
      }

      // Get all matching quotes first
      const { data, error } = await query.order('id', { ascending: true });

      if (error) throw error;
      if (!data?.length) {
        return c.json({
          success: true,
          count: 0,
          data: []
        }, { status: 200 });
      }

      // If single=true, return one random quote from results
      if (single) {
        const randomIndex = Math.floor(Math.random() * data.length);
        const randomQuote = data[randomIndex];
        return c.json({
          success: true,
          data: {
            id: randomQuote.id,
            anime: randomQuote.anime,
            character: randomQuote.character,
            quote: randomQuote.quote
          }
        }, { status: 200 });
      }

      // Otherwise return all matches
      return c.json({
        success: true,
        count: data.length,
        data
      }, { status: 200 });
    }

    // If no search parameters, return a random quote
    const { count } = await supabase
      .from('kartun')
      .select('*', { count: 'exact', head: true });

    if (!count) throw new Error('No quotes found');

    const randomOffset = Math.floor(Math.random() * count);
    const { data, error } = await query
      .range(randomOffset, randomOffset)
      .single();

    if (error || !data) {
      throw error || new Error('No quote found');
    }

    return c.json({
      success: true,
      data: {
        id: data.id,
        anime: data.anime,
        character: data.character,
        quote: data.quote
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching quote:', error)
    return c.json(
      { success: false, error: 'Failed to fetch quote' },
      { status: 500 }
    )
  }
});

// /api/v2/quotes/all - Get all quotes
quotesRouter.get("/all", async (c) => {
  try {
    const { data, error } = await supabase
      .from('kartun')
      .select('id, anime, character, quote')
      .order('id', { ascending: true });

    if (error) {
      throw error;
    }

    return c.json({
      success: true,
      count: data?.length || 0,
      data
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return c.json(
      { success: false, error: 'Failed to fetch quotes' },
      { status: 500 }
    )
  }
});

export { quotesRouter };