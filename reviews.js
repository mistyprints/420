// api/reviews.js
// Vercel Serverless Function: un file dentro /api diventa automaticamente
// un endpoint con lo stesso nome (api/reviews.js -> /api/reviews),
// senza nessun file di configurazione da creare.
//
// SETUP RICHIESTO SU VERCEL (una tantum):
//   Project -> Settings -> Environment Variables -> aggiungi
//     GOOGLE_PLACES_API_KEY = <la tua chiave>
//   poi ri-pubblica (Redeploy) perche' la legga.
//
// Stessa logica delle versioni precedenti: usa l'API "Legacy" di Google
// Places perche' e' l'unica che onora davvero reviews_sort=newest.

const PLACE_ID = "ChIJPQqx9McJxkcR0-9hr_O7fAg"; // 420 Cafe, Oudebrugsteeg, Amsterdam
const CODE_VERSION = "vercel-v1";

export async function GET() {
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

  if (!API_KEY) {
    const visibleKeys = Object.keys(process.env)
      .filter((k) => !k.startsWith("VERCEL") && !k.startsWith("AWS_") && k !== "PATH")
      .sort();
    return Response.json(
      {
        _version: CODE_VERSION,
        error: "GOOGLE_PLACES_API_KEY non impostata nelle Environment Variables del progetto Vercel.",
        debug_altre_variabili_visibili_qui: visibleKeys, // nomi soltanto, mai valori
      },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    place_id: PLACE_ID,
    fields: "name,rating,user_ratings_total,reviews",
    reviews_sort: "newest",
    key: API_KEY,
  });
  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status !== "OK") {
      // REQUEST_DENIED di solito vuol dire che sul progetto Google Cloud
      // manca l'abilitazione della "Places API" (senza "(New)" nel nome)
      // accanto a "Places API (New)".
      return Response.json(
        { _version: CODE_VERSION, error: `${data.status}: ${data.error_message || "errore dall'API Places (legacy)"}` },
        { status: 502 }
      );
    }

    const result = data.result || {};
    const shaped = {
      _version: CODE_VERSION,
      displayName: result.name || "420 Cafe",
      rating: result.rating,
      userRatingCount: result.user_ratings_total,
      reviews: (result.reviews || []).map((r) => ({
        rating: r.rating,
        text: { text: r.text || "" },
        authorAttribution: { displayName: r.author_name || "Anonimo" },
        publishTime: r.time ? new Date(r.time * 1000).toISOString() : null,
        relativePublishTimeDescription: r.relative_time_description || "",
      })),
    };

    return Response.json(shaped, { headers: { "Cache-Control": "public, max-age=120" } });
  } catch (err) {
    return Response.json({ _version: CODE_VERSION, error: String((err && err.message) || err) }, { status: 500 });
  }
}
