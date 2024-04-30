export class TentativasLoginExcedidas extends Error {
  constructor() {
    super()
    this.message = 'Tentativas de Login na plataforma BLING ESGOTADAS!'
    this.name = 'TentativasLoginExcedidas'
  }
}

