import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Amadeus from 'amadeus';
import mysql from 'mysql2/promise';
import session from 'express-session';

const app = express();

const port = 59682;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool({
    host: "jaurismousa.site",
    user: "jaurism1_jauris",
    password: "09012005Jm!?()",
    database: "jaurism1_project",
    connectionLimit: 10,
    waitForConnections: true
});

app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'csumb 336',
    resave: false,
    saveUninitialized: true
}))

app.get('/', (req, res) => {
    // res.render('index', { title: 'HOME', message: 'THIS IS HOME PAGE OF "336Final"' });
    res.render('login.ejs', { title: 'Login', message: 'Login to your account' });
});

app.get('/home', (req, res) => {
    res.render('index', { title: 'HOME', message: 'THIS IS HOME PAGE OF "336Final"' });
    // res.render('login.ejs', { title: 'Login', message: 'Login to your account' });
});


app.get('/findFlight', isAuthenticated, (req, res) => {
    res.render('findFlight.ejs');
});

//API KEY: UUAIGG4bE4MJMBbNqJ6vCck0awZk6UAl
//API SECRET: YlXYGImY9zDO6HsA
const amadeus = new Amadeus({
  clientId: "UUAIGG4bE4MJMBbNqJ6vCck0awZk6UAl",
  clientSecret: "YlXYGImY9zDO6HsA",
});

// Handle form submit
app.post('/search', isAuthenticated, async (req, res) => {
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

      console.log(JSON.stringify(response.data, null, 2));
      
      const filteredFlights = response.data.filter(flight => {
        const segments = flight.itineraries[0].segments;
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];
  
        return firstSegment.departure.iataCode === origin &&
               lastSegment.arrival.iataCode === destination;
      });
  
      //Remove duplicates based on carrier + flight number + departure time
      const uniqueOffersMap = new Map();
  
      for (const offer of filteredFlights) {
        const segments = offer.itineraries.flatMap(itinerary => itinerary.segments);
        const flightKey = segments.map(seg => `${seg.carrierCode}${seg.flightNumber}-${seg.departure.at}`).join('|');
  
        if (!uniqueOffersMap.has(flightKey)) {
          uniqueOffersMap.set(flightKey, offer);
        }
      }
  
      const uniqueOffers = Array.from(uniqueOffersMap.values());
  
      res.render('results', { flights: uniqueOffers });
    } catch (error) {
      console.error(error);
      res.send('Error fetching flights.');
    }
  });

  app.post('/saveFlight', isAuthenticated, async (req, res) => {
    const {
      origin,
      destination,
      date,
      returnDate,
      travelClass,
      price,
      currency,
      flightNumber
    } = req.body;
    const userId = req.session.userId;

    let [existingFlights] = await pool.query(
        `SELECT flightId, price FROM flights WHERE flightNumber = ? AND date = ? AND price = ?`,
        [flightNumber, date, price]
     );
    let flightId;

    if (existingFlights.length > 0) {
      flightId = existingFlights[0].flightId;
    } else {
      let result = await pool.query(
        `INSERT INTO flights (origin, destination, date, returnDate, travelClass, price, currency, flightNumber)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [origin, destination, date, returnDate, travelClass, price, currency, flightNumber]
      );
      flightId = result[0].insertId;
    }
    let [existingLink] = await pool.query(
      `SELECT * FROM userFlight WHERE userId = ? AND flightId = ?`,
      [userId, flightId]
    );
    if (existingLink.length === 0) {
      await pool.query(`INSERT INTO userFlight (userId, flightId) VALUES (?, ?)`, [userId, flightId]);
    }
  
    res.send('Flight saved successfully!');
  });
  

app.get('/savedFlights', isAuthenticated, async (req, res) => {
    let sql = `SELECT * FROM flights NATURAL JOIN userFlight WHERE flightId = flightId`;
    const [flights] = await pool.query(sql); // Use pool.query directly
    res.render('savedFlights.ejs', { flights });
});

app.post('/deleteFlight', async (req, res) => {
    const flightId = req.body.flightId;
    let sql = `DELETE FROM userFlight WHERE flightId = ?`;
    await pool.query(sql, [flightId]); // Use pool.query directly
    res.send('Flight deleted successfully!');
});

app.get('/login', (req,res) => {
    res.render('login.ejs')
});

app.post('/login', async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    let db_password = "";

    let sql = `SELECT *
               FROM users
               WHERE username = ?`;
     const [rows] = await pool.query(sql, [username]); 
     if (rows.length > 0) { //username was found!
        db_password = rows[0].password;
     }          

    if (password == db_password) {
        req.session.userAuthenticated = true;
        req.session.fullName = rows[0].firstName + " " + rows[0].lastName;
        req.session.userId = rows[0].userId;
        res.redirect('/home'); //whatever page is home here
    } else {
        res.render('login.ejs', {"error":"Wrong credentials!"})
    }
 });

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('login.ejs')
});

app.get('/signUp', async(req, res) => {
    res.render('signUp.ejs');  
});

app.post('/signUp', async(req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    if (username.length > 4 && password.length > 4){
        let sql = `INSERT INTO users (username, password) VALUES (?, ?)`;
        let params = [username, password];
        await pool.query(sql, params);
        res.render('login.ejs');
      }
      else{
        res.render('signUp.ejs');
      }
});

app.get('/logout', isAuthenticated, (req, res) => {
    req.session.destroy();
    res.render('login.ejs')
 });

app.get('/accounts', async(req, res) => {
  let sql = `SELECT * FROM users`;
  const [users] = await pool.query(sql);
  res.render("accounts.ejs", { users });
});

app.post('/deleteAccount',  async(req, res) => {
    let userId = req.body.userId;
    let sql = `DELETE FROM users WHERE userId = ?`;
    let sqlParams = [userId];
    const [rows] = await pool.query(sql, sqlParams);
    console.log(rows);
    res.redirect("/accounts");
});
  

app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});

// functions
function isAuthenticated(req, res, next){
    if(req.session.userAuthenticated){
        next();
    }
    else{
        res.redirect("/index.ejs");//wathever page is home here
    }
}

function isAdmin(req, res, next){
    if(req.session.userAuthenticated && req.session.isAdmin){
        next();
    }
    else{
        res.redirect("/index.ejs"); //wathever page is home here
    }
}
