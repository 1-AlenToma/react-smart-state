class A {
  text: string = "test";
  counter: number = 1;

  getText() {
    return this.text;
  }
}

class B extends A {
  userName: string = "Alen";
  selfRef: B;
  constructor() {
    super();
    this.selfRef = this;
  }

  get name() {
    return this.userName + " " + this.getText();
  }

  set name(name: string) {
    this.userName = name;
  }
}

class C extends B {
  fetchData() {
    return JSON.stringify(this);
  }
}

export default C;