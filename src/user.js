
import faker from 'faker';

const userFromLocalStorage = window.localStorage.user && JSON.parse(window.localStorage.user);

const user = userFromLocalStorage || {
  uuid: faker.random.uuid(),
  color: faker.internet.color(160, 160, 160),
  name: faker.name.findName(),
};

window.localStorage.user = JSON.stringify(user);

user.sessionUUID = faker.random.uuid();

export default user;
