import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

//for Express to get values using POST method
app.use(express.urlencoded({extended:true}));

//setting up database connection pool
const pool = mysql.createPool({
    host: "jaurismousa.site",
    user: "jaurism1_jauris",
    password: "09012005Jm!?()",
    database: "jaurism1_quotes",
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

//routes
app.get('/', (req, res) => {
   res.render('login.ejs')
});

app.get("/dbTest",isAuthenticated, async(req, res) => {
    let sql = "SELECT CURDATE()";
    const [rows] = await conn.query(sql);
    res.send(rows);
});//dbTest

app.listen(3000, ()=>{
    console.log("Express server running")
})

function isAuthenticated(req, res, next){
    if(req.session.userAuthenticated){
        next();
    }
    else{
        res.redirect("/");
    }
}

app.get('/profile', isAuthenticated, (req, res) => {
    res.render("profile.ejs", {"fullName": req.session.fullName});
});

app.get('/home', isAuthenticated, (req, res) => {
    res.render("home.ejs");
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
        res.render('home.ejs');
    } else {
        res.render('login.ejs', {"error":"Wrong credentials!"})
    }
 });

app.get('/logout', isAuthenticated, (req, res) => {
    req.session.destroy();
    res.render('login.ejs')
 });

app.get('/search', (req, res) => {
    res.render('search.ejs')
})

app.post('/search', (req, res) => {
    let origin = req.body.origin;
    let destination = req.body.destination;
    let date = req.body.date;
    let returnDate = req.body.returnDate;
    let travelClass = req.body.travelClass;
    let maxPrice = req.body.maxPrice;
    let currency = req.body.currency;
    let nonStop
    res.render('search.ejs')
})