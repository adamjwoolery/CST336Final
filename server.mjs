import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Amadeus from 'amadeus';
import { Console } from 'console';
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
    // res.render('index', { title: 'HOME', message: CSUMB Flight Reservation });
    res.render('login.ejs', { title: 'Login', message: 'Login to your account' });
});

app.get('/home', (req, res) => {
    res.render('index', { title: 'HOME', message: 'CSUMB Flight Reservation', isAdmin: req.session.isAdmin, isAuthenticated: req.session.userAuthenticated, currentPath: '/home' });
    // res.render('login.ejs', { title: 'Login', message: 'Login to your account' });
});


app.get('/findFlight', isAuthenticated, (req, res) => {
    res.render('findFlight.ejs', { isAdmin: req.session.isAdmin, isAuthenticated: req.session.userAuthenticated, currentPath: '/findFlight' });
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
      ...(returnDate && { returnDate }),
      ...(travelClass && { travelClass }),
      ...(maxPrice && { maxPrice }),
      ...(currency && { currencyCode: currency }),
      ...(nonStop && { nonStop: true }),
      adults: 1,
      max: 20
    });
    const filteredFlights = response.data.filter(flight => {
      const segments = flight.itineraries[0].segments;
      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];

      return firstSegment.departure.iataCode === origin &&
             lastSegment.arrival.iataCode === destination;
    });
    const uniqueOffersMap = new Map();
  
      for (const offer of filteredFlights) {
        const segments = offer.itineraries.flatMap(itinerary => itinerary.segments);
        const flightKey = segments.map(seg => `${seg.carrierCode}${seg.flightNumber}-${seg.departure.at}`).join('|');
  
        if (!uniqueOffersMap.has(flightKey)) {
          uniqueOffersMap.set(flightKey, offer);
        }
      }
  
      const uniqueOffers = Array.from(uniqueOffersMap.values());
  
    res.render('results', { flights: uniqueOffers, searchParams: req.body, isAdmin: req.session.isAdmin, isAuthenticated: req.session.userAuthenticated, currentPath: '/findFlight' });

    console.log('Request Body:', req.body);
    console.log('Filtered Data:', filteredFlights);
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
  
    res.redirect('/savedFlights');
  });
  

app.get('/savedFlights', isAuthenticated, async (req, res) => {
    let sql = `SELECT * FROM flights NATURAL JOIN userFlight WHERE flightId = flightId`;
    const [flights] = await pool.query(sql); // Use pool.query directly
    res.render('savedFlights.ejs', { flights, isAdmin: req.session.isAdmin, isAuthenticated: req.session.userAuthenticated, currentPath: '/savedFlights' });
});

app.post('/deleteFlight', async (req, res) => {
    const flightId = req.body.flightId;
    let sql = `DELETE FROM userFlight WHERE flightId = ?`;
    await pool.query(sql, [flightId]); // Use pool.query directly
    res.redirect('/savedFlights');
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
        req.session.isAdmin = false;
        if (rows[0].userId == 0) {
            req.session.isAdmin = true;
        }
        res.redirect('/home'); //whatever page is home here
    } else {
        res.render('login.ejs', {error:"Wrong credentials!"})
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

app.post('/register', async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  let sql = `INSERT INTO users (username, password) VALUES (?, ?)`;
  let params = [username, password];
  await pool.query(sql, params);
  res.render('login.ejs');
});

app.get('/accounts', isAdmin, async (req, res) => {
    let sql = `SELECT * FROM users`;
    const [users] = await pool.query(sql);
    res.render("accounts.ejs", { users, isAdmin: req.session.isAdmin, isAuthenticated: req.session.userAuthenticated, currentPath: '/accounts' });
});

app.post('/deleteAccount', isAdmin, async (req, res) => {
    let userId = req.query.userId;
    let sql = `DELETE FROM users WHERE userId = ?`;
    await pool.query(sql, [userId]);
    res.redirect("/accounts");
});

app.get('/updateLogin', isAuthenticated, async (req, res) => {
    let sql = `SELECT * FROM users WHERE userId = ?`;
    const [rows] = await pool.query(sql, [req.session.userId]);
    res.render('updateLogin.ejs', { user: rows[0], isAdmin: req.session.isAdmin, isAuthenticated: req.session.userAuthenticated, currentPath: '/updateLogin' });
});

app.post('/updateLogin', isAuthenticated, async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    let sql = `UPDATE users SET username = ?, password = ? WHERE userId = ?`;
    let params = [username, password, req.session.userId];
    await pool.query(sql, params);
    res.redirect('/home'); //whatever page is home here
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

function isAdmin(req, res, next) {
    if (req.session.userAuthenticated && req.session.isAdmin) {
        next();
    } else {
        res.status(403).send("Access denied. Admins only.");
    }
}
