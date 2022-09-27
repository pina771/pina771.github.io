---
title: "NestJS API"
date: 2022-09-17T19:20:59+02:00
draft: false
toc: true
tags: ["NestJS", "TypeScript", "Prisma", "PostgreSQL", "Testing"]
---

Showcase RESTful API made with NestJS & TypeScript. [GitHub](https://github.com/pina771/phost-api)

<!--more-->

_Writeup is currently in progress. Some more details could be added._

Made mainly for backend practice with NestJS & practicing TypeScript. A full CRUD API with authentication & file upload. Really, it's a rudimentary Instagram clone. Similiar to another project done as a university assignment ([CNR-api](https://github.com/pina771/cnr-api))
The projects consists of the following stack:
| | |
|---------------- |------------------ |
| Language(s) | TypeScript |
| Framework | NestJS |
| Database | PostgreSQL |
| ORM | Prisma |
| File Upload | Multer |
| Authentication | JWT |
| Documentation | Swagger |
| Testing | Jest & Supertest |

Below are some code examples & explanations that I thought are worth mentioning.

# Data info

The API data is fairly simple. The database consists of 2 tables (_so far_): users & posts with each table having a few characteristic properties. I have used PostgreSQL as my database of choice. Since I didn't really use ORMs in the past (go raw SQL!), I decided this would be a good opportunity to learn using [Prisma](https://www.prisma.io/).

{{<figure src="erd.png" caption="Entity-relationship diagram generated using PgAdmin 4">}}

The generated (and slightly altered) `prisma.schema` file:

```ts
model post {
  postId      Int       @id @default(autoincrement()) @map("post_id")
  userId      Int?      @map("user_id")
  title       String    @db.VarChar(220)
  description String?
  photoUrl    String?   @map("photo_url") @db.VarChar(120)
  createdAt   DateTime? @default(now()) @map("created_at") @db.Timestamp(6)
  user        user?     @relation(fields: [userId], references: [userId], onDelete: NoAction, onUpdate: NoAction)

  @@map("posts")
}

model user {
  userId          Int       @id @default(autoincrement()) @map("user_id")
  username        String    @unique(map: "username_uniq") @db.VarChar(50)
  password        String    @db.VarChar(50)
  email           String    @db.VarChar(50)
  firstName       String    @map("first_name") @db.VarChar(50)
  lastName        String    @map("last_name") @db.VarChar(50)
  createdAt       DateTime? @default(now()) @map("created_at") @db.Timestamp(6)
  profilePhotoUrl String?   @map("profile_photo_url") @db.VarChar(120)
  bio             String?   @db.VarChar(220)
  posts           post[]

  @@map("users")
}

```

# Testing

Testing the API is done using Jest & SuperTest. The tests make use of NestJS' dependency injection system for easily mocking components. Currently, only tests for the users route exists. Below are shown examples of the implemented tests with explanations. <!-- NOTE: Izmijeniti s vremenom -->

## Unit Tests

For unit testing, individual components are tested. Their dependencies are mocked. _Mocking_ is creating objects that simulate the behaviour of real objects. Using mocked components, we remove their logic from the test, which gives us an isolated component ready for testing. All tests done in this manner will test only the component logic.

### UsersController

Jumping right into the example, the `UsersController` class has a method for handling `GET` requests at the `/users/{id}` endpoint. We can see that it leaves the internal logic to the service. To test this method in a unit test, we can want to mock the `usersService.findOne(id)` method so that we don't have any external logic during testing.

```ts
@Get(':id')
async findOne(@Param('id') id: string): Promise<UserDto> {
  const res = await this.usersService.findOne(+id);
  if (res) return res;
  else throw new NotFoundException('User does not exist.');
}
```

Nest provides a breadth of testing utilities. Using the `Test` class and its method `createTestingModule`. The method takes a metadata argument and returns a `TestingModule` instance. We can call the `compile()` method on the module which will bootstrap and return a module ready for testing.

```ts {hl_lines=["8-18"], linenos=inline}
describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn().mockResolvedValue(testShortUsers),
            findOne: jest.fn().mockResolvedValue(testUserDto),
            create: jest.fn().mockResolvedValue(testUser1),
            remove: jest.fn().mockResolvedValue(true),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    usersController = moduleRef.get<UsersController>(UsersController);
    usersService = moduleRef.get<UsersService>(UsersService);
  });

...
```

In the above code block, we can see the usual NestJS module metadata. For this (testing) module, we only need the `UsersController` and `UsersService`. We use the actual `UsersController` implementation, while for the `UsersService` we provide a mock implementation. There are a few ways to accomplish this. I provided the mocked provider directly inside the metadata. You can also use the `overrideProvider` method as shown below:

```ts
...
const mockUsersService = {
  findAll: jest.fn().mockResolvedValue(testShortUsers),
  findOne: jest.fn().mockResolvedValue(testUserDto),
  create: jest.fn().mockResolvedValue(testUser1),
  remove: jest.fn().mockResolvedValue(true),
  update: jest.fn(),
}
const moduleRef = await Test.createTestingModule({
  controllers: [UsersController],
  providers: [UsersService]
}).overrideProvider(UsersService)
  .useValue(mockUsersService)
  .compile();
...
```

Looking at the controller function `findOne` (_at top of the chapter_), we can create two test cases. The first one is if everything proceeds as it should: the service finds the specified user in the database and returns it to the controller. In that case, the controller function should return a `UserDto`.
The other is if there is no user with the ID specified in the endpoint, in which case the function should throw a `NotFoundException`. For the second case we create a new mock for the `usersService.findOne(id)` function that returns `null`. We can do this using the `jest.SpyOn` where we provide a mocked implementation. In the test we catch the error and determine its instance.

```ts
describe("GET /users/:id", () => {
  it("Should return with ", async () => {
    await expect(usersController.findOne("5")).resolves.toBe(testUser1);
  });
  it("Should throw a NotFoundException when there is no user", async () => {
    jest
      .spyOn(usersService, "findOne")
      .mockImplementation(async (id: number) => {
        return null;
      });
    try {
      await usersController.findOne("5");
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundException);
    }
  });
});
```

### UsersService

Here, we will focus on the `create` method for creating a new user. The method itself can result in two distinct behaviours. If the username is not already taken, the service will call upon the `PrismaService` to persist the data into the DB. If it is already taken, the `PrismaService` will throw a known exception. The `create` method catches the exception and processes it by deleting the uploaded picture. It will throw a `ConflictException` which will cause Nest to return a 409 response to the HTTP request.

```ts
async create(createUserDto: CreateUserDto, profilePhotoUrl: string) {
  const dto = { ...createUserDto, profilePhotoUrl: profilePhotoUrl };
  try {
    return await this.prismaService.user.create({ data: dto });
  } catch (e) {
    // NOTE: If the user already exists, Prisma throws a ClientKnownRequestError
    // with the P2002 code. In this case we need to delete the image that Multer saved
    // and return a exception.
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code == 'P2002') {
        unlink(`uploads/${profilePhotoUrl}`, (err) => {
          if (err) throw err;
          else console.log(`uploads/${profilePhotoUrl} deleted.`);
        });
        throw new ConflictException('Username already exists.');
      }
    }
  }
}
```

The test below shows how to test the service behaviour if the username is already taken. Again, we make use of the `jest.SpyOn()` function, however here we assign it to a constant which can be used for assertions. We mock the `fs.unlink` function since it is used to delete the image. The same is done for the `prismaService.user.create` function. We mock the implementation so that it throws the expected error (_which we define somewhere earlier in the test_). Since we know that `PrismaService` will throw an exception, we expect the `UsersService` to call `unlink` and throw a `ConflictException`.

```ts
...
const prismaErrorMock = new PrismaClientKnownRequestError('', 'P2002', '');
...

describe('Create', () => {
  ...
  it('Should throw a ConflictException if username is taken.', async () => {
    const params = { ...testCreateUserDto, profilePhotoUrl: testPhotoUrl };
    const fsSpy = jest.spyOn(fs, 'unlink').mockImplementation(() => {
      return true;
    });
    const dbSpy = jest
      .spyOn(prismaService.user, 'create')
      .mockImplementationOnce((data) => {
        throw prismaErrorMock;
      });
    try {
      await usersService.create(testCreateUserDto, testPhotoUrl);
    } catch (e) {
      expect(dbSpy).toHaveBeenCalledWith({ data: params });
      expect(fsSpy).toHaveBeenCalled();
      expect(e).toBeInstanceOf(ConflictException);
    }
  });
});
```

# Documentation

Documentation is done using the NestJS Swagger module. The documentation generated conforms to the _OpenAPI_ specification & can be exported to other formats such as JSON or YAML. The module provides annotations that we can use for API endpoints & DTOs. We can see a couple of them below.

```ts
@Get(':id')
@ApiResponse({
  status: 200,
  type: UserDto,
  description:
    'Returns the general info (UserDto) about the user specified in the parameter.',
})
@ApiResponse({
  status: 404,
  description:
    "If there is no user with the defined ID, the API responds with a 404 that has the message 'User not found.'",
})
async findOne(@Param('id') id: string): Promise<UserDto> {
  /* ... */
}
```

```ts
export class UserDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({
    description:
      "Contains the name of the profile photo in the /uploads folder.",
  })
  profilePhotoUrl: string;

  @ApiProperty()
  bio: string;
}
```

<!-- {{<figure src="get-users-api.png" caption="Documentation generated by the Swagger module." width="720">}} -->
