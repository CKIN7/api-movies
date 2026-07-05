const express = require('express');
const data = require('./movies.json');
const moviesRouter = require('./routes/movieRoutes');
const app = express();

app.disable('x-powered-by');
app.use(express.json())

//Ruta que devuelve todas las peliculas y filtra por la query string
app.use('/movies', moviesRouter)






//Handle error 
app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message })
})

app.use((req, resp) => {
    resp.status(404).send('Ruta no encontrada')
})

const PORT = 8089;
app.listen(PORT, (req, resp) => {
    console.log('Servidor escuchando en http://localhost:', PORT)
});