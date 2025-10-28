// app/api/share/og/route.ts
import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = (searchParams.get('type') || 'image').toUpperCase();
    const idParam = searchParams.get('id') || 'unknown';
    const titleParam = searchParams.get('title') || `Shared item: ${idParam}`;

    // Theme colors based on type
    const theme =
      typeParam === 'DONKI'
        ? { bgFrom: '#1a0f2e', bgTo: '#2a1748', accent: '#f59e0b' }
        : typeParam === 'NEOWS'
        ? { bgFrom: '#071a2a', bgTo: '#0f2f44', accent: '#34d399' }
        : { bgFrom: '#0b1020', bgTo: '#1b2a4a', accent: '#60a5fa' };

    // Text truncation
    const title = titleParam.length > 120 ? titleParam.slice(0, 119) + '…' : titleParam;
    const shortId = idParam.length > 24 ? idParam.slice(0, 23) + '…' : idParam;

    // Simple JSX layout for OG image
    const element = {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: `linear-gradient(135deg, ${theme.bgFrom}, ${theme.bgTo})`,
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '26px 40px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      backgroundColor: theme.accent,
                      boxShadow: '0 0 24px rgba(255,255,255,0.45)',
                    },
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 24,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                    },
                    children: 'Cosmos Oracle',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      marginLeft: 16,
                      padding: '6px 12px',
                      borderRadius: 999,
                      fontSize: 18,
                      fontWeight: 700,
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.25)',
                    },
                    children: typeParam,
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flex: 1,
                alignItems: 'center',
                padding: '0 40px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 64,
                      fontWeight: 800,
                      lineHeight: 1.1,
                      maxWidth: 980,
                      textShadow: '0 6px 24px rgba(0,0,0,0.35)',
                    },
                    children: title,
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 40px',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.12))',
                borderTop: '1px solid rgba(255,255,255,0.18)',
                fontSize: 18,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { opacity: 0.95 },
                    children: 'cosmos-oracle.app · Share & Explore',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: 16, opacity: 0.7 },
                    children: `ID: ${shortId}`,
                  },
                },
              ],
            },
          },
        ],
      },
    };

    return new ImageResponse(element as any, {
      width: 1200,
      height: 630,
    });
  } catch (error) {
    console.error('OG image generation failed:', error);

    // Fallback image when generation fails
    const errorElement = {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1020',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { textAlign: 'center' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 40,
                      fontWeight: 800,
                      marginBottom: 12,
                    },
                    children: 'Cosmos Oracle',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: 22, opacity: 0.8 },
                    children: 'Failed to generate image',
                  },
                },
              ],
            },
          },
        ],
      },
    };

    return new ImageResponse(errorElement as any, {
      width: 1200,
      height: 630,
    });
  }
}
