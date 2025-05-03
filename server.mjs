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

      //  Filter manually to enforce strict origin/destination
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

app.post('/saveFlight', async (req, res) => {
    const origin = req.body.origin;
    const destination = req.body.destination;
    const date = req.body.date;
    const returnDate = req.body.returnDate;
    const travelClass = req.body.travelClass;
    const price = req.body.price;
    const currency = req.body.currency;
    const flightNumber = req.body.flightNumber;
    const userId = req.session.userId;
    let sqlFilght = `INSERT INTO flights (origin, destination, date, returnDate, travelClass, price, currency, flightNumber) VALUES (?,?,?,?,?,?,?,?)`;
    let paramsFlight = [origin, destination, date, returnDate, travelClass, price, currency, flightNumber];
    await pool.query(sqlFilght, paramsFlight); // Use pool.query directly
    let sql = `INSERT INTO userFlight VALUES (?,?)`;
    let flightId = (await pool.query(`SELECT flightId FROM flights WHERE flightNumber = ?`, [flightNumber]))[0][0].flightId;
    // console.log(flightId);
    let params = [userId, flightId];
    res.send('Flight saved successfully!');
});

app.get('/savedFlights', async (req, res) => {
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
        res.redirect('/home'); //whatever page is home here
    } else {
        res.render('login.ejs', {"error":"Wrong credentials!"})
    }
 });

app.get('/signUp', async(req, res) => {
    res.render('signUp.ejs');  
});

app.post('/signUp', async(req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    let sql = `INSERT INTO users (username, password) VALUES (?, ?)`;
    let params = [username, password];
    await pool.query(sql, params);
    res.render('login.ejs', {"error":"Account created!"});  
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

app.get('/accounts', isAdmin, async(req, res) => {
  let sql = `SELECT * FROM users`;
  const [users] = await pool.query(sql);
  res.render("accounts.ejs", { users });
});

app.get('/deleteAccount', isAdmin, async(req, res) => {
    let userId = req.query.userId;
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
