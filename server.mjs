import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import Amadeus from 'amadeus';

const app = express();

const port = 59682;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', { title: 'HOME', message: 'THIS IS HOME PAGE OF "336Final"' });
});

//API KEY: UUAIGG4bE4MJMBbNqJ6vCck0awZk6UAl
//API SECRET: YlXYGImY9zDO6HsA
const amadeus = new Amadeus({
  clientId: "UUAIGG4bE4MJMBbNqJ6vCck0awZk6UAl",
  clientSecret: "YlXYGImY9zDO6HsA",
});

async function main() {
  try {
    // Confirm availability and price from MAD to ATH in summer 2024
    const flightOffersResponse = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: "MAD",
      destinationLocationCode: "ATH",
      departureDate: "2025-07-01",
      adults: "1",
    });

    const response = await amadeus.shopping.flightOffers.pricing.post(
      {
        data: {
          type: "flight-offers-pricing",
          flightOffers: [flightOffersResponse.data[0]],
        },
      },
      { include: "credit-card-fees,detailed-fare-rules" }
    );
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error(error);
  }
}


main();



app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});
