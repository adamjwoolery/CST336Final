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
app.use(express.urlencoded({ extended: true }));



app.get('/', (req, res) => {
    res.render('index', { title: 'HOME', message: 'THIS IS HOME PAGE OF "336Final"' });
});
app.get('/findFlight', (req, res) => {
    res.render('findFlight.ejs');
});
//API KEY: UUAIGG4bE4MJMBbNqJ6vCck0awZk6UAl
//API SECRET: YlXYGImY9zDO6HsA
const amadeus = new Amadeus({
  clientId: "UUAIGG4bE4MJMBbNqJ6vCck0awZk6UAl",
  clientSecret: "YlXYGImY9zDO6HsA",
});

// Handle form submit
app.post('/search', async (req, res) => {
    const { origin, destination, date, returnDate, travelClass, maxPrice, currency, nonStop } = req.body;
  
    try {
      const response = await amadeus.shopping.flightOffersSearch.get({
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: date,
        ...(returnDate && { returnDate }),          // only add if user filled it
        ...(travelClass && { travelClass }),        // travel class (ECONOMY, BUSINESS, etc.)
        ...(maxPrice && { maxPrice }),              // max price limit
        ...(currency && { currencyCode: currency }),// currency code
        ...(nonStop && { nonStop: true }),           // checkbox sends "on" if checked
        adults: 1,
        max: 5
      });

      // 👇 Filter manually to enforce strict origin/destination
    const filteredFlights = response.data.filter(flight => {
        const segments = flight.itineraries[0].segments;
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];
  
        return firstSegment.departure.iataCode === origin &&
               lastSegment.arrival.iataCode === destination;
      });
  
      res.render('results', { flights: response.data });
    } catch (error) {
      console.error(error);
      res.send('Error fetching flights.');
    }
  });
  

app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});
