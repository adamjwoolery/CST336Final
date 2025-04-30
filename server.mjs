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

const pool = mysql.createPool({
    host: "jaurismousa.site",
    user: "jaurism1_jauris",
    password: "09012005Jm!?()",
    database: "jaurism1_project",
    connectionLimit: 10,
    waitForConnections: true
});
const conn = await pool.getConnection();

app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'csumb 336',
    resave: false,
    saveUninitialized: true
}))

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
    const flight = req.body.flight;
    console.log(flight);
    let sql = `INSERT INTO flights VALUES (?)`;
    res.send('Flight saved successfully!');
});

app.get('/savedFlights', async (req, res) => {
    let sql = `SELECT * FROM flights`;
    const [flights] = await conn.query(sql, params);
    res.render('savedFlights.ejs', { flights });
});

app.post('/deleteFlight', async (req, res) => {
    const flightId = req.body.flightId;
    let sql = `DELETE FROM flights WHERE flightId = ?`;
    await conn.query(sql, [flightId]);
    res.send('Flight deleted successfully!');
});

app.post('/login', async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;

    let hashedPassword = "";
    //let hashedPassword = "$2b$10$MV0mXcP/DBVu270RvRVTG.mBJUGRwVkwe9gVvatzg8zus9fow3WIi";

    let sql = `SELECT *
               FROM admin
               WHERE username = ?`;
     const [rows] = await conn.query(sql, [username]); 
     if (rows.length > 0) { //username was found!
        hashedPassword = rows[0].password;
     }          

    const match = await bcrypt.compare(password, hashedPassword);

    if (match) {
        req.session.userAuthenticated = true;
        req.session.fullName = rows[0].firstName + " " + rows[0].lastName;
        res.render('home.ejs'); //whatever page is home here
    } else {
        res.render('login.ejs', {"error":"Wrong credentials!"})
    }
 });

app.get('/logout', isAuthenticated, (req, res) => {
    req.session.destroy();
    res.render('login.ejs')
 });


app.get('/accounts', isAdmin, async(req, res) => {
  let sql = `SELECT * FROM users`;
  const [users] = await conn.query(sql);
  res.render("accounts.ejs", { users });
});

app.get('/deleteAccount', isAdmin, async(req, res) => {
    let userId = req.query.userId;
    let sql = `DELETE FROM users WHERE userId = ?`;
    let sqlParams = [userId];
    const [rows] = await conn.query(sql, sqlParams);
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
        res.redirect("/");//wathever page is home here
    }
}

function isAdmin(req, res, next){
    if(req.session.userAuthenticated && req.session.isAdmin){
        next();
    }
    else{
        res.redirect("/"); //wathever page is home here
    }
} 
