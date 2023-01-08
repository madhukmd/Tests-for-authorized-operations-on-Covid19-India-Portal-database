const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`server running at http://localhost:3000`);
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
  }
};
initializeDBAndServer();

//Authorization Middleware

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", async (error, playload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1
app.post("/login/", async (require, response) => {
  const { username, password } = require.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send(`Invalid user`);
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const playload = { username: username };
      const jwtToken = jwt.sign(playload, "SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send(`Invalid password`);
    }
  }
});

//API 2
const getStatesList = (list) => {
  return {
    stateId: list.state_id,
    stateName: list.state_name,
    population: list.population,
  };
};
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `SELECT * FROM state`;
  const getAllStates = await db.all(getAllStatesQuery);
  response.send(getAllStates.map((list) => getStatesList(list)));
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId}`;
  const getState = await db.get(getStateQuery);
  response.send(getStatesList(getState));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO
      district (district_name,state_id,cases,cured,active,deaths)
    VALUES
      (
        '${districtName}',
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
      );`;

  const dbResponse = await db.run(addDistrictQuery);
  response.send(`District Successfully Added`);
});

//API 5
const getDistrictList = (list) => {
  return {
    districtId: list.district_id,
    districtName: list.district_name,
    stateId: list.state_id,
    cases: list.cases,
    cured: list.cured,
    active: list.active,
    deaths: list.deaths,
  };
};
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId}`;
    const getDistrictObj = await db.get(getDistrictQuery);
    response.send(getDistrictList(getDistrictObj));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId}`;
    const deleteDistrict = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const updateDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = updateDetails;
    const updateDistrictQuery = `UPDATE district SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId}`;
    const updateDistrict = await db.run(updateDistrictQuery);
    response.send(`District Details Updated`);
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotalStatsQuery = `
   SELECT 
   sum(cases),
   sum(cured),
   sum(active),
   sum(deaths)
   FROM 
   district 
   WHERE state_id = ${stateId}`;
    const getAllStatsObj = await db.all(getTotalStatsQuery);
    //   console.log(getAllStatsObj);
    response.send({
      totalCases: getAllStatsObj[0]["sum(cases)"],
      totalCured: getAllStatsObj[0]["sum(cured)"],
      totalActive: getAllStatsObj[0]["sum(active)"],
      totalDeaths: getAllStatsObj[0]["sum(deaths)"],
    });
  }
);
module.exports = app;
