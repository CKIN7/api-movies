import mysql from 'mysql2/promise'
import type { Connection } from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export async function setupTestDb(): Promise<Connection> {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER || process.env.DB_user,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 3306
    })

    return conn
}

export async function teardownTestDb(conn: Connection): Promise<void> {
    await conn.end()
}

export async function clearTestData(conn: Connection): Promise<void> {
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0')
    await conn.execute('DELETE FROM refresh_tokens')
    await conn.execute('DELETE FROM email_verifications')
    await conn.execute('DELETE FROM reviews')
    await conn.execute('DELETE FROM user_watchlists')
    await conn.execute('DELETE FROM users')
    await conn.execute('DELETE FROM movie_actors')
    await conn.execute('DELETE FROM movie_genres')
    await conn.execute('DELETE FROM audit_log')
    await conn.execute('DELETE FROM movies')
    await conn.execute('DELETE FROM directors')
    await conn.execute('DELETE FROM genres')
    await conn.execute('DELETE FROM actors')
    await conn.execute('ALTER TABLE directors AUTO_INCREMENT = 1')
    await conn.execute('ALTER TABLE genres AUTO_INCREMENT = 1')
    await conn.execute('ALTER TABLE movies AUTO_INCREMENT = 1')
    await conn.execute('ALTER TABLE audit_log AUTO_INCREMENT = 1')
    await conn.execute('ALTER TABLE actors AUTO_INCREMENT = 1')
    await conn.execute('ALTER TABLE user_watchlists AUTO_INCREMENT = 1')
    await conn.execute('ALTER TABLE refresh_tokens AUTO_INCREMENT = 1')
    await conn.execute('ALTER TABLE email_verifications AUTO_INCREMENT = 1')
    await conn.execute('ALTER TABLE reviews AUTO_INCREMENT = 1')
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1')
}

export async function seedTestData(conn: Connection): Promise<void> {
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0')
    await conn.execute(`INSERT INTO directors (director_id, director_name) VALUES (1, 'Christopher Nolan')`)
    await conn.execute(`INSERT INTO directors (director_id, director_name) VALUES (2, 'Frank Darabont')`)
    await conn.execute(`INSERT INTO directors (director_id, director_name) VALUES (3, 'Quentin Tarantino')`)
    await conn.execute(`INSERT INTO directors (director_id, director_name) VALUES (4, 'Tim Burton')`)
    await conn.execute(`INSERT INTO directors (director_id, director_name) VALUES (5, 'Alex Proyas')`)

    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (1, 'action')`)
    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (2, 'sci-fi')`)
    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (3, 'drama')`)
    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (4, 'crime')`)
    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (5, 'horror')`)
    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (6, 'noir')`)

    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director, age_rating) VALUES (1, 'Inception', 2010, 8.8, 148, 'A thief who steals corporate secrets through dream-sharing.', 'https://example.com/inception.jpg', 1, 'PG-13')`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director, age_rating) VALUES (2, 'The Dark Knight', 2008, 9.0, 152, 'When the menace known as the Joker wreaks havoc.', 'https://example.com/darkknight.jpg', 1, 'PG-13')`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director, age_rating) VALUES (3, 'Interstellar', 2014, 8.6, 169, 'A team of explorers travel through a wormhole.', 'https://example.com/interstellar.jpg', 1, 'PG-13')`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director, age_rating) VALUES (4, 'The Shawshank Redemption', 1994, 9.3, 142, 'Two imprisoned men bond over a number of years.', 'https://example.com/shawshank.jpg', 2, 'R')`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director, age_rating) VALUES (5, 'Pulp Fiction', 1994, 8.9, 154, 'The lives of two mob hitmen.', 'https://example.com/pulpfiction.jpg', 3, 'R')`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director, age_rating) VALUES (6, 'Dark Shadows', 1994, 7.0, 113, 'An immortal vampire returns to his manor.', 'https://example.com/darkshadows.jpg', 4, 'PG-13')`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director, age_rating) VALUES (7, 'Dark City', 1998, 7.6, 100, 'A man struggles with memories of his past.', 'https://example.com/darkcity.jpg', 5, 'R')`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director, age_rating) VALUES (8, 'The Dark Knight Rises', 2012, 8.4, 165, 'Eight years after the Joker, Batman faces Bane.', 'https://example.com/darkknightrises.jpg', 1, 'PG-13')`)

    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 2)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (2, 1)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (3, 2)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (4, 3)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (5, 4)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (6, 3)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (6, 5)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (7, 2)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (7, 6)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (8, 1)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (8, 3)`)

    await conn.execute(`INSERT INTO actors (actor_id, actor_name) VALUES (1, 'Leonardo DiCaprio')`)
    await conn.execute(`INSERT INTO actors (actor_id, actor_name) VALUES (2, 'Joseph Gordon-Levitt')`)
    await conn.execute(`INSERT INTO actors (actor_id, actor_name) VALUES (3, 'Christian Bale')`)
    await conn.execute(`INSERT INTO actors (actor_id, actor_name) VALUES (4, 'Matthew McConaughey')`)
    await conn.execute(`INSERT INTO actors (actor_id, actor_name) VALUES (5, 'Tim Robbins')`)
    await conn.execute(`INSERT INTO actors (actor_id, actor_name) VALUES (6, 'John Travolta')`)
    await conn.execute(`INSERT INTO actors (actor_id, actor_name) VALUES (7, 'Johnny Depp')`)
    await conn.execute(`INSERT INTO actors (actor_id, actor_name) VALUES (8, 'Rufus Sewell')`)
    await conn.execute(`INSERT INTO actors (actor_id, actor_name) VALUES (9, 'Tom Hardy')`)

    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (1, 1, 'Dom Cobb')`)
    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (1, 2, 'Arthur')`)
    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (2, 3, 'Bruce Wayne')`)
    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (2, 9, 'Bane')`)
    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (3, 4, 'Joseph Cooper')`)
    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (4, 5, 'Andy Dufresne')`)
    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (5, 6, 'Vincent Vega')`)
    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (6, 7, 'Barnabas Collins')`)
    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (7, 8, 'John Murdoch')`)
    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (8, 3, 'Bruce Wayne')`)
    await conn.execute(`INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES (8, 9, 'Bane')`)

    // ===== 100 MOVIES ADDITIONALES =====

    // 10 nuevos directores
    const newDirectors = [
        [6, 'Steven Spielberg'],
        [7, 'Martin Scorsese'],
        [8, 'James Cameron'],
        [9, 'Ridley Scott'],
        [10, 'David Fincher'],
        [11, 'Peter Jackson'],
        [12, 'Denis Villeneuve'],
        [13, 'Greta Gerwig'],
        [14, 'Bong Joon-ho'],
        [15, 'Jordan Peele'],
    ]
    await conn.query('INSERT INTO directors (director_id, director_name) VALUES ?', [newDirectors])

    // 4 nuevos géneros
    const newGenres = [
        [7, 'comedy'],
        [8, 'thriller'],
        [9, 'romance'],
        [10, 'adventure'],
    ]
    await conn.query('INSERT INTO genres (id_genre, genre_name) VALUES ?', [newGenres])

    // 20 nuevos actores
    const newActors = [
        [10, 'Morgan Freeman'],
        [11, 'Tom Hanks'],
        [12, 'Meryl Streep'],
        [13, 'Brad Pitt'],
        [14, 'Scarlett Johansson'],
        [15, 'Robert Downey Jr.'],
        [16, 'Samuel L. Jackson'],
        [17, 'Cate Blanchett'],
        [18, 'Jake Gyllenhaal'],
        [19, 'Natalie Portman'],
        [20, 'Willem Dafoe'],
        [21, 'Amy Adams'],
        [22, 'Joaquin Phoenix'],
        [23, 'Margot Robbie'],
        [24, 'Oscar Isaac'],
        [25, 'Saoirse Ronan'],
        [26, 'Daniel Kaluuya'],
        [27, 'Florence Pugh'],
        [28, 'Pedro Pascal'],
        [29, 'Austin Butler'],
        [30, 'Orson Welles'],
        [31, 'Judy Garland'],
        [32, 'Humphrey Bogart'],
        [33, 'Anthony Perkins'],
        [34, 'Keir Dullea'],
    ]
    await conn.query('INSERT INTO actors (actor_id, actor_name) VALUES ?', [newActors])

    // 100 películas (ids 9-108)
    const newMovies = [
        [9, 'The Godfather', 1972, 9.2, 175, 'The aging patriarch of an organized crime dynasty.', 'https://example.com/godfather.jpg', 2, 'PG-13'],
        [10, 'Schindler\'s List', 1993, 9.0, 195, 'Oskar Schindler saves Jewish lives during Holocaust.', 'https://example.com/schindler.jpg', 6, 'R'],
        [11, 'Fight Club', 1999, 8.8, 139, 'An insomniac and a soap salesman build a fight club.', 'https://example.com/fightclub.jpg', 10, 'R'],
        [12, 'Forrest Gump', 1994, 8.8, 142, 'A man with low IQ witnesses historical events.', 'https://example.com/forrest.jpg', 9, 'PG'],
        [13, 'The Matrix', 1999, 8.7, 136, 'A computer hacker learns about the true nature of reality.', 'https://example.com/matrix.jpg', 8, 'PG-13'],
        [14, 'Goodfellas', 1990, 8.7, 146, 'A young man grows up in the mafia.', 'https://example.com/goodfellas.jpg', 7, 'R'],
        [15, 'Parasite', 2019, 8.5, 132, 'A poor family infiltrates a wealthy household.', 'https://example.com/parasite.jpg', 14, 'R'],
        [16, 'Gladiator', 2000, 8.5, 155, 'A Roman general seeks vengeance as a gladiator.', 'https://example.com/gladiator.jpg', 9, 'PG-13'],
        [17, 'The Lord of the Rings: The Fellowship of the Ring', 2001, 8.8, 178, 'A hobbit embarks on a quest to destroy a ring.', 'https://example.com/lotr1.jpg', 11, 'PG-13'],
        [18, 'The Lord of the Rings: The Two Towers', 2002, 8.7, 179, 'The fellowship continues the quest amid war.', 'https://example.com/lotr2.jpg', 11, 'PG-13'],
        [19, 'The Lord of the Rings: The Return of the King', 2003, 8.9, 201, 'The final battle for Middle-earth.', 'https://example.com/lotr3.jpg', 11, 'PG-13'],
        [20, 'Jaws', 1975, 8.1, 124, 'A giant shark terrorizes a beach town.', 'https://example.com/jaws.jpg', 6, 'PG'],
        [21, 'Get Out', 2017, 7.7, 104, 'A young black man visits his white girlfriend\'s family.', 'https://example.com/getout.jpg', 15, 'R'],
        [22, 'Dune', 2021, 8.0, 155, 'A noble family fights for control of a desert planet.', 'https://example.com/dune.jpg', 12, 'PG-13'],
        [23, 'Barbie', 2023, 6.9, 114, 'Barbie leaves Barbieland for the real world.', 'https://example.com/barbie.jpg', 13, 'PG-13'],
        [24, 'The Social Network', 2010, 7.7, 120, 'The founding of Facebook.', 'https://example.com/socialnetwork.jpg', 10, 'PG-13'],
        [25, 'Gone Girl', 2014, 8.1, 149, 'A wife disappears on her anniversary.', 'https://example.com/gonegirl.jpg', 10, 'PG-13'],
        [26, 'Taxi Driver', 1976, 8.2, 114, 'A taxi driver descends into madness.', 'https://example.com/taxidriver.jpg', 7, 'R'],
        [27, 'E.T. the Extra-Terrestrial', 1982, 7.9, 115, 'A boy befriends an alien.', 'https://example.com/et.jpg', 6, 'PG'],
        [28, 'Saving Private Ryan', 1998, 8.6, 169, 'Soldiers search for a missing paratrooper.', 'https://example.com/savingryan.jpg', 6, 'PG-13'],
        [29, 'The Departed', 2006, 8.5, 151, 'A mole in the police and a mole in the mob.', 'https://example.com/departed.jpg', 7, 'R'],
        [30, 'Jurassic Park', 1993, 8.2, 127, 'Dinosaurs are cloned on a remote island.', 'https://example.com/jurassic.jpg', 6, 'PG'],
        [31, 'Arrival', 2016, 7.9, 116, 'A linguist communicates with aliens.', 'https://example.com/arrival.jpg', 12, 'PG-13'],
        [32, 'Blade Runner 2049', 2017, 8.0, 164, 'A replicant uncovers a secret.', 'https://example.com/bladerunner.jpg', 12, 'PG-13'],
        [33, 'Se7en', 1995, 8.6, 127, 'Two detectives hunt a serial killer using the seven deadly sins.', 'https://example.com/se7en.jpg', 10, 'R'],
        [34, 'Inside Out', 2015, 8.1, 95, 'Emotions inside a young girl.', 'https://example.com/insideout.jpg', 12, 'PG'],
        [35, 'The Silence of the Lambs', 1991, 8.6, 118, 'An FBI trainee seeks help from a cannibal killer.', 'https://example.com/silence.jpg', 9, 'R'],
        [36, 'Alien', 1979, 8.2, 117, 'A spaceship crew is hunted by an alien.', 'https://example.com/alien.jpg', 9, 'R'],
        [37, 'Titanic', 1997, 7.9, 194, 'A romance aboard the ill-fated Titanic.', 'https://example.com/titanic.jpg', 8, 'PG'],
        [38, 'Avatar', 2009, 7.9, 162, 'A marine on an alien planet.', 'https://example.com/avatar.jpg', 8, 'PG-13'],
        [39, 'Whiplash', 2014, 8.5, 106, 'A drummer pushes himself under an abusive teacher.', 'https://example.com/whiplash.jpg', 6, 'R'],
        [40, 'Mad Max: Fury Road', 2015, 8.1, 120, 'A post-apocalyptic chase across the desert.', 'https://example.com/madmax.jpg', 8, 'PG-13'],
        [41, 'No Country for Old Men', 2007, 8.1, 122, 'A man stumbles upon drug money in Texas.', 'https://example.com/nocountry.jpg', 6, 'PG-13'],
        [42, 'The Big Lebowski', 1998, 8.1, 117, 'A slacker is mistaken for a millionaire.', 'https://example.com/biglebowski.jpg', 3, 'R'],
        [43, 'Prisoners', 2013, 8.1, 153, 'A father searches for his missing daughter.', 'https://example.com/prisoners.jpg', 12, 'R'],
        [44, 'La La Land', 2016, 8.0, 128, 'A musician and an actress fall in love in LA.', 'https://example.com/lalaland.jpg', 13, 'PG-13'],
        [45, 'The Shining', 1980, 8.4, 146, 'A family stays at an isolated hotel.', 'https://example.com/shining.jpg', 7, 'R'],
        [46, '12 Years a Slave', 2013, 8.1, 134, 'A free man is sold into slavery.', 'https://example.com/12years.jpg', 6, 'PG-13'],
        [47, 'Zootopia', 2016, 8.0, 108, 'A rabbit police officer solves a mystery.', 'https://example.com/zootopia.jpg', 12, 'G'],
        [48, 'Coco', 2017, 8.4, 105, 'A boy visits the Land of the Dead.', 'https://example.com/coco.jpg', 11, 'G'],
        [49, 'The Grand Budapest Hotel', 2014, 8.1, 99, 'A hotel concierge is framed for murder.', 'https://example.com/grandbudapest.jpg', 6, 'PG-13'],
        [50, 'Django Unchained', 2012, 8.4, 165, 'A freed slave hunts bounty with a dentist.', 'https://example.com/django.jpg', 3, 'R'],
        [51, 'The Prestige', 2006, 8.5, 130, 'Two magicians engage in a bitter rivalry.', 'https://example.com/prestige.jpg', 1, 'PG-13'],
        [52, 'Memento', 2000, 8.4, 113, 'A man with short-term memory loss hunts his wife\'s killer.', 'https://example.com/memento.jpg', 1, 'R'],
        [53, 'Inglourious Basterds', 2009, 8.3, 153, 'A squad of Jewish soldiers hunt Nazis.', 'https://example.com/basterds.jpg', 3, 'PG-13'],
        [54, 'The Green Mile', 1999, 8.6, 189, 'A prison guard discovers a miraculous inmate.', 'https://example.com/greenmile.jpg', 2, 'R'],
        [55, 'The Lion King', 1994, 8.5, 88, 'A lion cub flees after his father\'s death.', 'https://example.com/lionking.jpg', 9, 'G'],
        [56, 'Braveheart', 1995, 8.3, 178, 'A Scottish warrior leads a rebellion.', 'https://example.com/braveheart.jpg', 8, 'PG-13'],
        [57, 'Back to the Future', 1985, 8.5, 116, 'A teen travels back in time in a DeLorean.', 'https://example.com/bttf.jpg', 9, 'PG'],
        [58, 'The Truman Show', 1998, 8.2, 103, 'A man discovers his life is a TV show.', 'https://example.com/truman.jpg', 11, 'PG'],
        [59, 'Eternal Sunshine of the Spotless Mind', 2004, 8.3, 108, 'A couple erases memories of each other.', 'https://example.com/eternalsunshine.jpg', 8, 'R'],
        [60, 'The Sixth Sense', 1999, 8.1, 107, 'A boy who sees dead people.', 'https://example.com/sixthsense.jpg', 6, 'R'],
        [61, 'A Clockwork Orange', 1971, 8.3, 136, 'A violent teenager is conditioned to be good.', 'https://example.com/clockwork.jpg', 6, 'R'],
        [62, 'Amélie', 2001, 8.3, 122, 'A shy waitress changes lives around her.', 'https://example.com/amelie.jpg', 8, 'PG'],
        [63, 'The Pianist', 2002, 8.5, 150, 'A Jewish pianist survives the Warsaw ghetto.', 'https://example.com/pianist.jpg', 9, 'PG-13'],
        [64, 'The Revenant', 2015, 8.0, 156, 'A frontiersman survives a bear attack.', 'https://example.com/revenant.jpg', 6, 'R'],
        [65, 'Spotlight', 2015, 8.1, 129, 'Journalists investigate child abuse in the Church.', 'https://example.com/spotlight.jpg', 7, 'R'],
        [66, 'Joker', 2019, 8.3, 122, 'A failed comedian descends into madness.', 'https://example.com/joker.jpg', 15, 'R'],
        [67, 'Interstellar 2', 2022, 7.5, 150, 'A sequel exploring new dimensions.', 'https://example.com/interstellar2.jpg', 1, 'PG-13'],
        [68, 'The Batman', 2022, 7.8, 176, 'Batman investigates a serial killer in Gotham.', 'https://example.com/thebatman.jpg', 12, 'PG-13'],
        [69, 'Everything Everywhere All at Once', 2022, 7.8, 139, 'A woman explores multiverses.', 'https://example.com/eeaao.jpg', 12, 'PG-13'],
        [70, 'Top Gun: Maverick', 2022, 8.3, 130, 'Maverick trains a new generation of pilots.', 'https://example.com/topgun.jpg', 8, 'PG-13'],
        [71, 'Oppenheimer', 2023, 8.4, 180, 'The father of the atomic bomb.', 'https://example.com/oppenheimer.jpg', 1, 'PG-13'],
        [72, 'Poor Things', 2023, 7.8, 141, 'A woman is brought back to life by a scientist.', 'https://example.com/poorthings.jpg', 8, 'NC-17'],
        [73, 'The Whale', 2022, 7.7, 117, 'A reclusive teacher tries to reconnect with his daughter.', 'https://example.com/whale.jpg', 12, 'PG-13'],
        [74, 'Aftersun', 2022, 7.7, 102, 'A woman remembers a holiday with her father.', 'https://example.com/aftersun.jpg', 13, 'PG-13'],
        [75, 'The Banshees of Inisherin', 2022, 7.7, 114, 'Two friends fall out on a remote island.', 'https://example.com/banshees.jpg', 7, 'PG-13'],
        [76, 'All Quiet on the Western Front', 2022, 7.6, 148, 'A young soldier experiences WWI.', 'https://example.com/allquiet.jpg', 8, 'PG-13'],
        [77, 'RRR', 2022, 7.8, 187, 'Two Indian revolutionaries fight British rule.', 'https://example.com/rrr.jpg', 14, 'PG-13'],
        [78, 'The Father', 2020, 8.3, 97, 'An aging man deals with dementia.', 'https://example.com/father.jpg', 10, 'PG-13'],
        [79, 'Soul', 2020, 8.0, 100, 'A musician travels to the afterlife.', 'https://example.com/soul.jpg', 11, 'G'],
        [80, 'Tenet', 2020, 7.3, 150, 'A secret agent manipulates time.', 'https://example.com/tenet.jpg', 1, 'PG-13'],
        [81, '1917', 2019, 8.2, 119, 'Two soldiers deliver a message in WWI.', 'https://example.com/1917.jpg', 9, 'PG-13'],
        [82, 'Knives Out', 2019, 7.9, 130, 'A detective investigates a family death.', 'https://example.com/knivesout.jpg', 9, 'PG-13'],
        [83, 'Ford v Ferrari', 2019, 8.1, 152, 'Car builders race for Le Mans.', 'https://example.com/fordferrari.jpg', 8, 'PG-13'],
        [84, 'Marriage Story', 2019, 7.9, 137, 'A couple navigates a divorce.', 'https://example.com/marriagestory.jpg', 13, 'R'],
        [85, 'Once Upon a Time in Hollywood', 2019, 7.6, 161, 'An actor and his stunt double in 1969 Hollywood.', 'https://example.com/onceupon.jpg', 3, 'R'],
        [86, 'Spider-Man: Into the Spider-Verse', 2018, 8.4, 117, 'Miles Morales becomes Spider-Man.', 'https://example.com/spiderverse.jpg', 11, 'G'],
        [87, 'A Star Is Born', 2018, 7.6, 136, 'A musician helps a rising star.', 'https://example.com/starisborn.jpg', 8, 'PG-13'],
        [88, 'Hereditary', 2018, 7.3, 127, 'A family haunted by dark secrets.', 'https://example.com/hereditary.jpg', 10, 'R'],
        [89, 'Bohemian Rhapsody', 2018, 7.9, 134, 'The story of Queen and Freddie Mercury.', 'https://example.com/bohemian.jpg', 8, 'PG-13'],
        [90, 'Black Panther', 2018, 7.3, 134, 'A king defends his African nation.', 'https://example.com/blackpanther.jpg', 8, 'PG-13'],
        [91, 'Three Billboards Outside Ebbing, Missouri', 2017, 8.1, 115, 'A mother seeks justice for her daughter.', 'https://example.com/threebillboards.jpg', 7, 'R'],
        [92, 'Dunkirk', 2017, 7.8, 106, 'Allied soldiers evacuate from Dunkirk.', 'https://example.com/dunkirk.jpg', 1, 'PG-13'],
        [93, 'Lady Bird', 2017, 7.4, 94, 'A teenager navigates her senior year.', 'https://example.com/ladybird.jpg', 13, 'R'],
        [94, 'The Shape of Water', 2017, 7.3, 123, 'A janitor falls in love with an aquatic creature.', 'https://example.com/shapeofwater.jpg', 10, 'PG-13'],
        [95, 'Moonlight', 2016, 7.4, 111, 'A young black man grows up in Miami.', 'https://example.com/moonlight.jpg', 10, 'R'],
        [96, 'Manchester by the Sea', 2016, 7.8, 137, 'A man cares for his nephew after a tragedy.', 'https://example.com/manchester.jpg', 7, 'R'],
        [97, 'Room', 2015, 8.1, 118, 'A woman and her son escape captivity.', 'https://example.com/room.jpg', 10, 'R'],
        [98, 'The Wolf of Wall Street', 2013, 8.2, 180, 'A stockbroker lives a life of excess.', 'https://example.com/wolf.jpg', 7, 'R'],
        [99, 'Birdman', 2014, 7.7, 119, 'An actor struggles with his ego.', 'https://example.com/birdman.jpg', 10, 'R'],
        [100, '12 Angry Men', 1957, 9.0, 96, 'A jury deliberates a murder case.', 'https://example.com/12angrymen.jpg', 6, 'R'],
        [101, 'Citizen Kane', 1941, 8.3, 119, 'A newspaper magnate\'s life is examined.', 'https://example.com/citizenkane.jpg', 9, 'PG'],
        [102, 'The Wizard of Oz', 1939, 8.1, 102, 'A girl travels to a magical land.', 'https://example.com/wizardofoz.jpg', 8, 'G'],
        [103, 'Casablanca', 1942, 8.5, 102, 'A nightclub owner rekindles a romance.', 'https://example.com/casablanca.jpg', 8, 'R'],
        [104, 'Psycho', 1960, 8.5, 109, 'A secretary steals and encounters a motel.', 'https://example.com/psycho.jpg', 6, 'R'],
        [105, 'Vertigo', 1958, 8.3, 128, 'A detective falls for a mysterious woman.', 'https://example.com/vertigo.jpg', 6, 'R'],
        [106, '2001: A Space Odyssey', 1968, 8.3, 149, 'Astronauts encounter a mysterious monolith.', 'https://example.com/2001.jpg', 8, 'PG-13'],
        [107, 'Apocalypse Now', 1979, 8.4, 147, 'A captain journeys to kill a rogue colonel.', 'https://example.com/apocalypse.jpg', 2, 'R'],
        [108, 'The Good, the Bad and the Ugly', 1966, 8.8, 178, 'Three gunslingers search for gold.', 'https://example.com/goodbadugly.jpg', 8, 'PG-13'],
    ]
    await conn.query('INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director, age_rating) VALUES ?', [newMovies])

    // movie_genres para las nuevas películas (movie_id, genre_id)
    const newMovieGenres = [
        [9, 4], [9, 3], [10, 3], [11, 3], [12, 3], [12, 9], [13, 2], [13, 1], [14, 4], [14, 3],
        [15, 8], [15, 3], [16, 1], [16, 3], [17, 10], [17, 1], [18, 10], [18, 1], [19, 10], [19, 1],
        [20, 8], [20, 10], [21, 8], [21, 5], [22, 2], [22, 10], [23, 7], [23, 10], [24, 3], [24, 8],
        [25, 8], [25, 3], [26, 4], [26, 3], [27, 2], [27, 10], [28, 1], [28, 3], [29, 4], [29, 8],
        [30, 10], [30, 2], [31, 2], [31, 3], [32, 2], [32, 3], [33, 4], [33, 8], [34, 7], [34, 10],
        [35, 8], [35, 4], [36, 2], [36, 5], [37, 9], [37, 3], [38, 2], [38, 10], [39, 3], [39, 7],
        [40, 1], [40, 2], [41, 4], [41, 8], [42, 7], [42, 4], [43, 8], [43, 4], [44, 9], [44, 7],
        [45, 5], [45, 8], [46, 3], [46, 8], [47, 7], [47, 10], [48, 7], [48, 10], [49, 7], [49, 10],
        [50, 3], [50, 10], [51, 3], [51, 8], [52, 8], [52, 4], [53, 10], [53, 3], [54, 3], [54, 4],
        [55, 7], [55, 10], [56, 1], [56, 3], [57, 2], [57, 10], [58, 7], [58, 3], [59, 9], [59, 2],
        [60, 8], [60, 3], [61, 4], [61, 2], [62, 7], [62, 9], [63, 3], [63, 8], [64, 10], [64, 3],
        [65, 4], [65, 3], [66, 4], [66, 3], [67, 2], [67, 3], [68, 4], [68, 8], [69, 2], [69, 10],
        [70, 1], [70, 3], [71, 3], [71, 8], [72, 7], [72, 2], [73, 3], [74, 3], [75, 7], [75, 3],
        [76, 1], [76, 3], [77, 1], [77, 3], [78, 3], [79, 7], [79, 10], [80, 2], [80, 1], [81, 1], [81, 3],
        [82, 4], [82, 7], [83, 1], [83, 3], [84, 9], [84, 3], [85, 7], [85, 3], [86, 10], [86, 7],
        [87, 9], [87, 3], [88, 5], [88, 8], [89, 3], [89, 7], [90, 1], [90, 10], [91, 4], [91, 3],
        [92, 1], [92, 3], [93, 7], [93, 3], [94, 9], [94, 3], [95, 3], [96, 3], [97, 3], [97, 8],
        [98, 7], [98, 4], [99, 7], [99, 3], [100, 4], [100, 3], [101, 3], [102, 10], [102, 7],
        [103, 9], [103, 3], [104, 5], [104, 8], [105, 8], [105, 9], [106, 2], [107, 1], [107, 3], [108, 10], [108, 3],
    ]
    await conn.query('INSERT INTO movie_genres (movie_id, genre_id) VALUES ?', [newMovieGenres])

    // movie_actors para las nuevas películas
    const newMovieActors = [
        [9, 12, 'Don Vito Corleone'], [9, 13, 'Michael Corleone'],
        [10, 11, 'Oskar Schindler'], [10, 10, 'Itzhak Stern'],
        [11, 13, 'Tyler Durden'], [11, 18, 'The Narrator'],
        [12, 11, 'Forrest Gump'], [12, 10, 'Jenny Curran'],
        [13, 14, 'Neo'], [13, 19, 'Trinity'],
        [14, 15, 'Henry Hill'], [14, 16, 'Tommy DeVito'],
        [15, 16, 'Kim Ki-taek'], [15, 25, 'Park Soo-ah'],
        [16, 15, 'Maximus'], [16, 17, 'Commodus'],
        [17, 17, 'Gandalf'], [17, 22, 'Frodo'],
        [18, 17, 'Gandalf'], [18, 22, 'Frodo'],
        [19, 17, 'Gandalf'], [19, 22, 'Frodo'],
        [20, 15, 'Chief Brody'], [20, 10, 'Quint'],
        [21, 26, 'Chris Washington'], [21, 27, 'Rose Armitage'],
        [22, 24, 'Paul Atreides'], [22, 27, 'Chani'],
        [23, 23, 'Barbie'], [23, 15, 'Ken'],
        [24, 18, 'Mark Zuckerberg'], [24, 22, 'Eduardo Saverin'],
        [25, 13, 'Nick Dunne'], [25, 21, 'Amy Dunne'],
        [26, 15, 'Travis Bickle'], [26, 12, 'Iris'],
        [27, 11, 'Elliott'], [27, 17, 'Mary'],
        [28, 11, 'Captain Miller'], [28, 10, 'Sergeant Horvath'],
        [29, 15, 'Billy Costigan'], [29, 16, 'Frank Costello'],
        [30, 16, 'Dr. Grant'], [30, 10, 'Dr. Malcolm'],
        [31, 21, 'Dr. Louise Banks'], [31, 22, 'Ian Donnelly'],
        [32, 15, 'Officer K'], [32, 13, 'Niander Wallace'],
        [33, 10, 'Somerset'], [33, 13, 'Mills'],
        [34, 21, 'Joy'], [34, 20, 'Sadness'],
        [35, 12, 'Clarice Starling'], [35, 20, 'Hannibal Lecter'],
        [36, 16, 'Ripley'], [36, 20, 'Dallas'],
        [37, 1, 'Jack Dawson'], [37, 14, 'Rose DeWitt'],
        [38, 14, 'Jake Sully'], [38, 16, 'Colonel Quaritch'],
        [39, 18, 'Andrew Neiman'], [39, 15, 'Terence Fletcher'],
        [40, 9, 'Max Rockatansky'], [40, 14, 'Imperator Furiosa'],
        [41, 16, 'Anton Chigurh'], [41, 10, 'Ed Tom Bell'],
        [42, 16, 'The Dude'], [42, 10, 'Donny'],
        [43, 18, 'Keller Dover'], [43, 28, 'Detective Loki'],
        [44, 15, 'Sebastian'], [44, 14, 'Mia'],
        [45, 15, 'Jack Torrance'], [45, 12, 'Wendy Torrance'],
        [46, 12, 'Solomon Northup'], [46, 17, 'Edwin Epps'],
        [47, 17, 'Officer Hopps'], [47, 20, 'Nick Wilde'],
        [48, 21, 'Miguel'], [48, 20, 'Héctor'],
        [49, 20, 'M. Gustave'], [49, 10, 'Zero'],
        [50, 15, 'Django'], [50, 1, 'Dr. King Schultz'],
        [51, 15, 'Alfred Borden'], [51, 3, 'Robert Angier'],
        [52, 15, 'Leonard'], [52, 13, 'Natalie'],
        [53, 13, 'Lt. Aldo Raine'], [53, 15, 'Col. Hans Landa'],
        [54, 11, 'Paul Edgecomb'], [54, 10, 'John Coffey'],
        [55, 16, 'Mufasa'], [55, 22, 'Simba'],
        [56, 8, 'William Wallace'], [56, 10, 'Robert the Bruce'],
        [57, 10, 'Doc Brown'], [57, 11, 'Marty McFly'],
        [58, 15, 'Truman Burbank'], [58, 12, 'Meryl'],
        [59, 15, 'Joel'], [59, 17, 'Clementine'],
        [60, 20, 'Dr. Malcolm Crowe'], [60, 10, 'Cole Sear'],
        [61, 15, 'Alex DeLarge'], [61, 20, 'Mr. Deltoid'],
        [62, 19, 'Amélie Poulain'], [62, 20, 'Nino Quincampoix'],
        [63, 17, 'Wladyslaw Szpilman'], [63, 20, 'His Father'],
        [64, 1, 'Hugh Glass'], [64, 20, 'John Fitzgerald'],
        [65, 20, 'Robbie'], [65, 22, 'Michael'],
        [66, 22, 'Arthur Fleck'], [66, 23, 'Sophie Dumond'],
        [67, 4, 'Joseph Cooper'], [67, 2, 'Arthur'],
        [68, 15, 'Bruce Wayne'], [68, 18, 'Selina Kyle'],
        [69, 14, 'Evelyn Wang'], [69, 12, 'Deirdre Beaubeirdre'],
        [70, 11, 'Maverick'], [70, 12, 'Penny Benjamin'],
        [71, 29, 'J. Robert Oppenheimer'], [71, 15, 'Lewis Strauss'],
        [72, 20, 'Bella Baxter'], [72, 10, 'Godwin Baxter'],
        [73, 22, 'Charlie'], [73, 27, 'Ellie'],
        [74, 17, 'Sophie'], [74, 15, 'Calum'],
        [75, 20, 'Pádraic Súilleabháin'], [75, 17, 'Colm Doherty'],
        [76, 10, 'Paul Bäumer'], [76, 20, 'Stanislaus Katczinsky'],
        [77, 24, 'Bheem'], [77, 27, 'Raju'],
        [78, 15, 'Anthony'], [78, 14, 'Anne'],
        [79, 14, 'Joe Gardner'], [79, 20, '22'],
        [80, 1, 'The Protagonist'], [80, 15, 'Neil'],
        [81, 15, 'Will Schofield'], [81, 20, 'Tom Blake'],
        [82, 15, 'Benoit Blanc'], [82, 20, 'Harlan Thrombey'],
        [83, 3, 'Ken Miles'], [83, 16, 'Carroll Shelby'],
        [84, 14, 'Nicole'], [84, 16, 'Charlie'],
        [85, 1, 'Rick Dalton'], [85, 13, 'Cliff Booth'],
        [86, 16, 'Miles Morales'], [86, 14, 'Gwen Stacy'],
        [87, 13, 'Jackson Maine'], [87, 14, 'Ally'],
        [88, 12, 'Annie Graham'], [88, 22, 'Peter'],
        [89, 15, 'Freddie Mercury'], [89, 12, 'Mary Austin'],
        [90, 16, 'T\'Challa'], [90, 14, 'Nakia'],
        [91, 12, 'Mildred Hayes'], [91, 20, 'Chief Bill Willoughby'],
        [92, 11, 'Tommy'], [92, 12, 'Mr. Dawson'],
        [93, 25, 'Lady Bird'], [93, 12, 'Marion McPherson'],
        [94, 21, 'Elisa Esposito'], [94, 20, 'Strickland'],
        [95, 16, 'Chiron'], [95, 20, 'Juan'],
        [96, 17, 'Lee Chandler'], [96, 20, 'Patrick Chandler'],
        [97, 17, 'Ma'], [97, 18, 'Jack'],
        [98, 1, 'Jordan Belfort'], [98, 23, 'Naomi Lapaglia'],
        [99, 15, 'Riggan Thomson'], [99, 14, 'Sam Thomson'],
        [100, 15, 'Juror 8'], [100, 20, 'Juror 3'],
        [101, 15, 'Charles Foster Kane'], [101, 30, 'Jedediah Leland'],
        [102, 15, 'Dorothy'], [102, 30, 'Scarecrow'],
        [103, 15, 'Rick Blaine'], [103, 14, 'Ilsa Lund'],
        [104, 15, 'Norman Bates'], [104, 30, 'Marion Crane'],
        [105, 15, 'Scottie Ferguson'], [105, 30, 'Madeleine Elster'],
        [106, 15, 'Dr. Dave Bowman'], [106, 30, 'HAL 9000'],
        [107, 15, 'Captain Willard'], [107, 30, 'Colonel Kurtz'],
        [108, 15, 'Blondie'], [108, 30, 'Tuco'],
    ]
    await conn.query('INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES ?', [newMovieActors])
    
    await conn.query(`INSERT INTO users (id, email, password_hash, role, email_verified) VALUES ('cfd74902-7d20-4653-bdf6-759bb4947956', 'admin@example.com', '\$2b\$10\$FJf.i/9zmq.cwTCuEFTbQe2LA3lAhEYGdSwkOhdmMRh3whFNvEen2', 'admin', 1)`)

    

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1')
}