// function Persona(nombre, edad) {
//     return nombre = 'nombre'
//     edad = edad
// }

// const pedro = new Persona('h')

// console.log(pedro)

class Autos {
    constructor(marca, modelo) {
        this.marcao = marca;
        this.modelo = modelo;
    }

    run() {
        console.log('runnn');
    }
}

const focus = new Autos('Ford', 'Focus')
focus.run()
console.log(focus);
