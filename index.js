////////////////////////////////////////////////////////////////////////
// Ray Tracing

var gl;

// for storing points and indices of square
var sqVertexPositionBuffer;
var sqVertexIndexBuffer;

var aPositionLocation;
var uLightLocation;
var uAmbientCoeff;
var uDiffusionCoeff;
var uSpecularCoeff;
var uShineCoeff;
var uAmbientLight;
var uDiffusionLight;
var uSpecularLight;
var uBounceLocation;

var bounce = [1.0];
var z = 2.0;
var x = 0.0;
var flag = 0;
// set up the parameters for lighting 
var light_ambient = [0.0, 1.0, 0.0, 1];
var light_diffuse = [0.0, 1.0, 0.0, 1]; 
var light_specular = [0.9, 0.9, 0.9, 1]; 
var light_pos = [0.0, 7.0, 10.0, 1];   // eye space position 

var mat_ambient = [0.2, 0.2, 0.2, 1]; 
var mat_diffuse= [0.5, 0.5, 0.5, 1]; 
var mat_specular = [0.9, 0.9, 0.9, 1]; 
var mat_shine = [20.0];

const vertexShaderCode = `#version 300 es
in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const fragShaderCode = `#version 300 es
precision mediump float;

#define SPHERE 0


uniform vec4 lightPos; 
uniform vec4 ambientCoeff;
uniform vec4 diffuseCoeff;
uniform vec4 specularCoeff;
uniform float matShininess; 
uniform vec4 lightAmbient; 
uniform vec4 lightDiffuse; 
uniform vec4 lightSpecular;
uniform float BOUNCES;

out vec4 fragColor;

struct Sphere {
  vec3 center;
  float radius;
  vec4 color;
  float shininess;
};

struct Ray{
  vec3 origin;
  vec3 direction;
};

Sphere sphere[4];
Ray ray;

bool solveUtil(float a, float b, float c, out float t0, out float t1){
  float disc = b * b - 4.0 * a * c;
  
  if (disc < 0.0)
  {
    return false;
  } 
  
  if (disc == 0.0)
  {
    t0 = t1 = -b / (2.0 * a);
    return true;
  }
  
  t0 = (-b + sqrt(disc)) / (2.0 * a);
  t1 = (-b - sqrt(disc)) / (2.0 * a);
  return true;    
}

bool intersectionPoint(vec3 origin, vec3 direction, Sphere sphere, out float objDistance, out vec3 surfaceNormal, out vec3 pixelHit){
  vec3 distanceFromCenter = (origin - sphere.center);
  float A = dot(direction, direction);
  float B = 2.0 * dot(direction, distanceFromCenter);
  float C = dot(distanceFromCenter, distanceFromCenter) - pow(sphere.radius, 2.0);

  float t0;
  float t1;

  if(solveUtil(A, B, C, t0, t1)){
    if(t0 > t1){
      float temp = t0;
      t0 = t1;
      t1 = temp;
    }
    if(t0 < 0.0){
      t0 = t1;
      if(t0 < 0.0){
        return false;
      }
    }

    objDistance = t0;

    pixelHit = origin + objDistance * direction;
    surfaceNormal = normalize(pixelHit - sphere.center);

    return true;
  }
  return false;
}

vec4 getColorValue(in vec3 viewDir, in vec3 surfacePointPosition, in vec4 objectColor, in vec3 surfaceNormal){
  vec3 lightVector = normalize(vec3(lightPos) - surfacePointPosition);
  vec3 reflectionVector = normalize(-reflect(lightVector, surfaceNormal));
  vec3 viewVector = normalize(viewDir);

  vec4 ambient = ambientCoeff * objectColor;

  float ndotl = max(dot(surfaceNormal, lightVector), 0.0);
  vec4 diffuse = diffuseCoeff * objectColor * ndotl;

  float rdotv = max(dot(-reflectionVector, viewVector), 0.0);
  vec4 specular;
  if (rdotv > 0.0) 
    specular = specularCoeff * lightSpecular * pow(rdotv, matShininess); 
  else
    specular = vec4(0, 0, 0, 1); 
  vec4 color = ambient + diffuse + specular;
  return color;
}

void shadowUtil(vec3 pixelHit, inout vec4 finalColor, vec4 ambient, int type, int index)
{
  // Intersect spheres
  vec3 shadowNormal;
  vec3 shadowRay = vec3(lightPos) - pixelHit;
  vec3 shadowRayDirection = normalize(shadowRay);
  float distanceToLight = sqrt(dot(shadowRay, shadowRay));
  vec3 shadowPixelHit;
  
  float distance; 
    
  for(int i = 0; i < 4; ++i)
	{
    if (type == SPHERE && index == i)
    {
      continue;  
    }

    if (intersectionPoint(pixelHit, shadowRay, sphere[i], distance, shadowNormal, shadowPixelHit))
    {
      if (distance > 0.0 && distanceToLight > distance)
      {
        finalColor *= 2.0 * ambientCoeff; 
      }
    }
  }   
}

void main() {
  fragColor = vec4(0,0,0,1);

  sphere[0].center = vec3(0.0, 1.0, -2.5);
  sphere[0].radius = 2.4;
  sphere[0].color = vec4(1.0, 0.0, 0.0, 1.0);
  
  sphere[1].center = vec3(-1.5, 0.2, 1.3);
  sphere[1].radius = 0.9;
  sphere[1].color = vec4(0.0, 1.0, 0.0, 1.0);
  
  sphere[2].center = vec3(1.5, 0.2, 1.3);
  sphere[2].radius = 0.9;
  sphere[2].color = vec4(0.0, 0.0, 1.0, 1.0);
  
  sphere[3].center = vec3(0.0, -16, -2.0);
  sphere[3].radius = 14.0;
  sphere[3].color = vec4(211.0/255.0, 211.0/255.0, 211.0/255.0, 1.0);

  ray.origin = vec3(0.0, 0.0, 4.0);
  vec2 screenPos = gl_FragCoord.xy/vec2(550.0, 550.0);
  ray.direction = normalize(vec3(screenPos * 2.0 - 1.0, -1.0));

  int previousType = -1;
  int previousIndex = -1;

  vec3 pixelHit = ray.origin;
  vec3 passPixelHit;

  for(float bounce = 0.0; bounce < BOUNCES; bounce++){
    float distance = 1.0 / 0.0;
    float objDistance = distance;

    vec3 surfaceNormal;
    
    int type = -1;
    int index = -1;

    vec4 passColor = vec4(0.0,0.0,0.0,1.0);

    for (int i = 0; i < 4; i++)
    {          
      if (previousType == SPHERE && previousIndex == i)
      {
        continue;
      }
      
      if (intersectionPoint(ray.origin, ray.direction, sphere[i], objDistance, surfaceNormal, pixelHit))
      {                
        if (objDistance < distance)
        {
          distance = objDistance;
          passColor = getColorValue(ray.direction, pixelHit, sphere[i].color, surfaceNormal);
          if(bounce == 0.0)
            shadowUtil(pixelHit, passColor, sphere[i].color, SPHERE, i);
          
          type = SPHERE;
          index = i;
          passPixelHit = pixelHit;
        }
      }
    }
    if (bounce == 0.0)
    {
      fragColor += passColor;
    }
    else
    {
      fragColor += specularCoeff * lightSpecular * passColor;
    }
    
    if(type < 0)  break;

    ray.origin = passPixelHit;
    ray.direction = reflect(ray.direction, surfaceNormal);
    
    previousType = type;
    previousIndex = index;
  }

}`;

const vertexShaderCode1 = `#version 300 es
in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const fragShaderCode1 = `#version 300 es
precision mediump float;

uniform vec4 lightPos; 
uniform vec4 ambientCoeff;
uniform vec4 diffuseCoeff;
uniform vec4 specularCoeff;
uniform float matShininess; 
uniform vec4 lightAmbient; 
uniform vec4 lightDiffuse; 
uniform vec4 lightSpecular;
uniform float BOUNCES;

out vec4 fragColor;

struct Sphere {
  vec3 center;
  float radius;
  vec4 color;
};

struct Ray{
  vec3 origin;
  vec3 direction;
};

Sphere sphere[4];
Ray ray;

bool solveUtil(float a, float b, float c, out float t0, out float t1){
  float disc = b * b - 4.0 * a * c;
  
  if (disc < 0.0)
  {
    return false;
  } 
  
  if (disc == 0.0)
  {
    t0 = t1 = -b / (2.0 * a);
    return true;
  }
  
  t0 = (-b + sqrt(disc)) / (2.0 * a);
  t1 = (-b - sqrt(disc)) / (2.0 * a);
  return true;    
}

bool intersectionPoint(vec3 origin, vec3 direction, Sphere sphere, out float objDistance, out vec3 surfaceNormal, out vec3 pixelHit){
  vec3 distanceFromCenter = (origin - sphere.center);
  float A = dot(direction, direction);
  float B = 2.0 * dot(direction, distanceFromCenter);
  float C = dot(distanceFromCenter, distanceFromCenter) - pow(sphere.radius, 2.0);

  float t0;
  float t1;

  if(solveUtil(A, B, C, t0, t1)){
    if(t0 > t1){
      float temp = t0;
      t0 = t1;
      t1 = temp;
    }
    if(t0 < 0.0){
      t0 = t1;
      if(t0 < 0.0){
        return false;
      }
    }

    objDistance = t0;

    pixelHit = origin + objDistance * direction;
    surfaceNormal = normalize(pixelHit - sphere.center);

    return true;
  }
  return false;
}

vec4 getColorValue(in vec3 viewDir, in vec3 surfacePointPosition, in vec4 objectColor, in vec3 surfaceNormal){
  vec3 lightVector = normalize(vec3(lightPos) - surfacePointPosition);
  vec3 reflectionVector = normalize(-reflect(lightVector, surfaceNormal));
  vec3 viewVector = normalize(viewDir);

  vec4 ambient = ambientCoeff * objectColor;

  float ndotl = max(dot(surfaceNormal, lightVector), 0.0);
  vec4 diffuse = diffuseCoeff * objectColor * ndotl;

  float rdotv = max(dot(-reflectionVector, viewVector), 0.0);
  vec4 specular;
  if (rdotv > 0.0) 
    specular = specularCoeff * lightSpecular * pow(rdotv, matShininess); 
  else
    specular = vec4(0, 0, 0, 1); 
  vec4 color = ambient + diffuse + specular;
  return color;
}

void main() {
  fragColor = vec4(0,0,0,1);

  sphere[0].center = vec3(0.0, 1.0, -2.5);
  sphere[0].radius = 2.4;
  sphere[0].color = vec4(1.0, 0.0, 0.0, 1.0);
  
  sphere[1].center = vec3(-1.5, 0.2, 1.3);
  sphere[1].radius = 0.9;
  sphere[1].color = vec4(0.0, 1.0, 0.0, 1.0);
  
  sphere[2].center = vec3(1.5, 0.2, 1.3);
  sphere[2].radius = 0.9;
  sphere[2].color = vec4(0.0, 0.0, 1.0, 1.0);
  
  sphere[3].center = vec3(0.0, -16, -2.0);
  sphere[3].radius = 14.0;
  sphere[3].color = vec4(211.0/255.0, 211.0/255.0, 211.0/255.0, 1.0);

  ray.origin = vec3(0.0, 0.0, 4.0);
  vec2 screenPos = gl_FragCoord.xy/vec2(550.0, 550.0);
  ray.direction = normalize(vec3(screenPos * 2.0 - 1.0, -1.0));

  vec3 pixelHit;
  float objDistance;

  vec3 surfaceNormal;

  for (int i = 0; i < 4; i++)
  {          
    if (intersectionPoint(ray.origin, ray.direction, sphere[i], objDistance, surfaceNormal, pixelHit))
    {     
      fragColor = getColorValue(ray.direction, pixelHit, sphere[i].color, surfaceNormal);
    }
  }

}`;

const vertexShaderCode2 = `#version 300 es
in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const fragShaderCode2 = `#version 300 es
precision mediump float;

#define SPHERE 0


uniform vec4 lightPos; 
uniform vec4 ambientCoeff;
uniform vec4 diffuseCoeff;
uniform vec4 specularCoeff;
uniform float matShininess; 
uniform vec4 lightAmbient; 
uniform vec4 lightDiffuse; 
uniform vec4 lightSpecular;
uniform float BOUNCES;

out vec4 fragColor;

struct Sphere {
  vec3 center;
  float radius;
  vec4 color;
};

struct Ray{
  vec3 origin;
  vec3 direction;
};

Sphere sphere[4];
Ray ray;

bool solveUtil(float a, float b, float c, out float t0, out float t1){
  float disc = b * b - 4.0 * a * c;
  
  if (disc < 0.0)
  {
    return false;
  } 
  
  if (disc == 0.0)
  {
    t0 = t1 = -b / (2.0 * a);
    return true;
  }
  
  t0 = (-b + sqrt(disc)) / (2.0 * a);
  t1 = (-b - sqrt(disc)) / (2.0 * a);
  return true;    
}

bool intersectionPoint(vec3 origin, vec3 direction, Sphere sphere, out float objDistance, out vec3 surfaceNormal, out vec3 pixelHit){
  vec3 distanceFromCenter = (origin - sphere.center);
  float A = dot(direction, direction);
  float B = 2.0 * dot(direction, distanceFromCenter);
  float C = dot(distanceFromCenter, distanceFromCenter) - pow(sphere.radius, 2.0);

  float t0;
  float t1;

  if(solveUtil(A, B, C, t0, t1)){
    if(t0 > t1){
      float temp = t0;
      t0 = t1;
      t1 = temp;
    }
    if(t0 < 0.0){
      t0 = t1;
      if(t0 < 0.0){
        return false;
      }
    }

    objDistance = t0;

    pixelHit = origin + objDistance * direction;
    surfaceNormal = normalize(pixelHit - sphere.center);

    return true;
  }
  return false;
}

vec4 getColorValue(in vec3 viewDir, in vec3 surfacePointPosition, in vec4 objectColor, in vec3 surfaceNormal){
  vec3 lightVector = normalize(vec3(lightPos) - surfacePointPosition);
  vec3 reflectionVector = normalize(-reflect(lightVector, surfaceNormal));
  vec3 viewVector = normalize(viewDir);

  vec4 ambient = ambientCoeff * objectColor;

  float ndotl = max(dot(surfaceNormal, lightVector), 0.0);
  vec4 diffuse = diffuseCoeff * objectColor * ndotl;

  float rdotv = max(dot(-reflectionVector, viewVector), 0.0);
  vec4 specular;
  if (rdotv > 0.0) 
    specular = specularCoeff * lightSpecular * pow(rdotv, matShininess); 
  else
    specular = vec4(0, 0, 0, 1); 
  vec4 color = ambient + diffuse + specular;
  return color;
}

void shadowUtil(vec3 pixelHit, inout vec4 finalColor, vec4 ambient, int type, int index)
{
  // Intersect spheres
  vec3 shadowNormal;
  vec3 shadowRay = vec3(lightPos) - pixelHit;
  vec3 shadowRayDirection = normalize(shadowRay);
  float distanceToLight = sqrt(dot(shadowRay, shadowRay));
  vec3 shadowPixelHit;
  
  float distance; 
    
  for(int i = 0; i < 4; ++i)
	{
    if (type == SPHERE && index == i)
    {
      continue;  
    }

    if (intersectionPoint(pixelHit, shadowRay, sphere[i], distance, shadowNormal, shadowPixelHit))
    {
      if (distance > 0.0 && distanceToLight > distance)
      {
        finalColor *= 2.0 * ambientCoeff; 
      }
    }
  }   
}

void main() {
  fragColor = vec4(0,0,0,1);

  sphere[0].center = vec3(0.0, 1.0, -2.5);
  sphere[0].radius = 2.4;
  sphere[0].color = vec4(1.0, 0.0, 0.0, 1.0);
  
  sphere[1].center = vec3(-1.5, 0.2, 1.3);
  sphere[1].radius = 0.9;
  sphere[1].color = vec4(0.0, 1.0, 0.0, 1.0);
  
  sphere[2].center = vec3(1.5, 0.2, 1.3);
  sphere[2].radius = 0.9;
  sphere[2].color = vec4(0.0, 0.0, 1.0, 1.0);
  
  sphere[3].center = vec3(0.0, -16, -2.0);
  sphere[3].radius = 14.0;
  sphere[3].color = vec4(211.0/255.0, 211.0/255.0, 211.0/255.0, 1.0);

  ray.origin = vec3(0.0, 0.0, 4.0);
  vec2 screenPos = gl_FragCoord.xy/vec2(550.0, 550.0);
  ray.direction = normalize(vec3(screenPos * 2.0 - 1.0, -1.0));

  int previousType = -1;
  int previousIndex = -1;

  vec3 pixelHit = ray.origin;
  vec3 passPixelHit;

  for(int bounce = 0; bounce < 1; bounce++){
    float distance = 1.0 / 0.0;
    float objDistance = distance;

    vec3 surfaceNormal;
    
    int type = -1;
    int index = -1;

    vec4 passColor = vec4(0.0,0.0,0.0,1.0);

    for (int i = 0; i < 4; i++)
    {          
      if (previousType == SPHERE && previousIndex == i)
      {
        continue;
      }
      
      if (intersectionPoint(ray.origin, ray.direction, sphere[i], objDistance, surfaceNormal, pixelHit))
      {                
        if (objDistance < distance)
        {
          distance = objDistance;
          passColor = getColorValue(ray.direction, pixelHit, sphere[i].color, surfaceNormal);
          shadowUtil(pixelHit, passColor, sphere[i].color, SPHERE, i);
          
          type = SPHERE;
          index = i;
          passPixelHit = pixelHit;
        }
      }
    }
    fragColor += specularCoeff * lightSpecular * passColor;
    
    if(type < 0)  break;

    ray.origin = passPixelHit;
    ray.direction = reflect(ray.direction, surfaceNormal);
    
    previousType = type;
    previousIndex = index;
  }

}`;

const vertexShaderCode3 = `#version 300 es
in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const fragShaderCode3 = `#version 300 es
precision mediump float;

#define SPHERE 0


uniform vec4 lightPos; 
uniform vec4 ambientCoeff;
uniform vec4 diffuseCoeff;
uniform vec4 specularCoeff;
uniform float matShininess; 
uniform vec4 lightAmbient; 
uniform vec4 lightDiffuse; 
uniform vec4 lightSpecular;
uniform float BOUNCES;

out vec4 fragColor;

struct Sphere {
  vec3 center;
  float radius;
  vec4 color;
};

struct Ray{
  vec3 origin;
  vec3 direction;
};

Sphere sphere[4];
Ray ray;

bool solveUtil(float a, float b, float c, out float t0, out float t1){
  float disc = b * b - 4.0 * a * c;
  
  if (disc < 0.0)
  {
    return false;
  } 
  
  if (disc == 0.0)
  {
    t0 = t1 = -b / (2.0 * a);
    return true;
  }
  
  t0 = (-b + sqrt(disc)) / (2.0 * a);
  t1 = (-b - sqrt(disc)) / (2.0 * a);
  return true;    
}

bool intersectionPoint(vec3 origin, vec3 direction, Sphere sphere, out float objDistance, out vec3 surfaceNormal, out vec3 pixelHit){
  vec3 distanceFromCenter = (origin - sphere.center);
  float A = dot(direction, direction);
  float B = 2.0 * dot(direction, distanceFromCenter);
  float C = dot(distanceFromCenter, distanceFromCenter) - pow(sphere.radius, 2.0);

  float t0;
  float t1;

  if(solveUtil(A, B, C, t0, t1)){
    if(t0 > t1){
      float temp = t0;
      t0 = t1;
      t1 = temp;
    }
    if(t0 < 0.0){
      t0 = t1;
      if(t0 < 0.0){
        return false;
      }
    }

    objDistance = t0;

    pixelHit = origin + objDistance * direction;
    surfaceNormal = normalize(pixelHit - sphere.center);

    return true;
  }
  return false;
}

vec4 getColorValue(in vec3 viewDir, in vec3 surfacePointPosition, in vec4 objectColor, in vec3 surfaceNormal){
  // vec3 lightVector = surfacePointPosition - vec3(lightPos);
  // vec3 lightDir = normalize(lightVector);

  // float lightIntensity = (pow(0.1, 2.0) / pow(length(lightVector), 2.0)) * 15.0;

  // vec3 reflectionVector = normalize(-reflect(lightVector, surfaceNormal));
  // vec3 viewVector = normalize(viewDir);

  // vec4 ambient = ambientCoeff * objectColor;

  // float ndotl = max(-dot(lightDir, surfaceNormal), 0.0);
  // vec4 diffuse = diffuseCoeff * objectColor * ndotl;

  // float rdotv = max(dot(-reflectionVector, viewVector), 0.0);
  // vec4 specular;
  // if (rdotv > 0.0) 
  //   specular = specularCoeff * lightSpecular * pow(rdotv, matShininess); 
  // else
  //   specular = vec4(0, 0, 0, 1);

  // // vec3 halfwayDir = normalize(lightDir + viewDir);  
  // // vec4 specular = pow(max(-dot(surfaceNormal, halfwayDir), 0.0), matShininess) * specularCoeff  * objectColor * lightIntensity;
 

  // vec4 color = ambient + diffuse + specular;

  // return color;
  vec3 lightVector = normalize(vec3(lightPos) - surfacePointPosition);
  vec3 reflectionVector = normalize(-reflect(lightVector, surfaceNormal));
  vec3 viewVector = normalize(viewDir);

  vec4 ambient = ambientCoeff * objectColor;

  float ndotl = max(dot(surfaceNormal, lightVector), 0.0);
  vec4 diffuse = diffuseCoeff * objectColor * ndotl;

  float rdotv = max(dot(-reflectionVector, viewVector), 0.0);
  vec4 specular;
  if (rdotv > 0.0) 
    specular = specularCoeff * lightSpecular * pow(rdotv, matShininess); 
  else
    specular = vec4(0, 0, 0, 1); 
  vec4 color = ambient + diffuse + specular;
  return color;
}

void shadowUtil(vec3 pixelHit, inout vec4 finalColor, vec4 ambient, int type, int index)
{
  // Intersect spheres
  vec3 shadowNormal;
  vec3 shadowRay = vec3(lightPos) - pixelHit;
  vec3 shadowRayDirection = normalize(shadowRay);
  float distanceToLight = sqrt(dot(shadowRay, shadowRay));
  vec3 shadowPixelHit;
  
  float distance; 
    
  for(int i = 0; i < 4; ++i)
	{
    if (type == SPHERE && index == i)
    {
      continue;  
    }

    if (intersectionPoint(pixelHit, shadowRay, sphere[i], distance, shadowNormal, shadowPixelHit))
    {
      if (distance > 0.0 && distanceToLight > distance)
      {
        finalColor *= 2.0 * ambientCoeff; 
      }
    }
  }   
}

void main() {
  fragColor = vec4(0,0,0,1);

  sphere[0].center = vec3(0.0, 1.0, -2.5);
  sphere[0].radius = 2.4;
  sphere[0].color = vec4(1.0, 0.0, 0.0, 1.0);
  
  sphere[1].center = vec3(-1.5, 0.2, 1.3);
  sphere[1].radius = 0.9;
  sphere[1].color = vec4(0.0, 1.0, 0.0, 1.0);
  
  sphere[2].center = vec3(1.5, 0.2, 1.3);
  sphere[2].radius = 0.9;
  sphere[2].color = vec4(0.0, 0.0, 1.0, 1.0);
  
  sphere[3].center = vec3(0.0, -16, -2.0);
  sphere[3].radius = 14.0;
  sphere[3].color = vec4(211.0/255.0, 211.0/255.0, 211.0/255.0, 1.0);

  ray.origin = vec3(0.0, 0.0, 4.0);
  vec2 screenPos = gl_FragCoord.xy/vec2(550.0, 550.0);
  ray.direction = normalize(vec3(screenPos * 2.0 - 1.0, -1.0));

  int previousType = -1;
  int previousIndex = -1;

  vec3 pixelHit = ray.origin;
  vec3 passPixelHit;

  for(float bounce = 0.0; bounce < BOUNCES; bounce++){
    float distance = 1.0 / 0.0;
    float objDistance = distance;

    vec3 surfaceNormal;
    
    int type = -1;
    int index = -1;

    vec4 passColor = vec4(0.0,0.0,0.0,1.0);

    for (int i = 0; i < 4; i++)
    {          
      if (previousType == SPHERE && previousIndex == i)
      {
        continue;
      }
      
      if (intersectionPoint(ray.origin, ray.direction, sphere[i], objDistance, surfaceNormal, pixelHit))
      {                
        if (true)
        {
          distance = objDistance;
          passColor = getColorValue(ray.direction, pixelHit, sphere[i].color, surfaceNormal);
          
          type = SPHERE;
          index = i;
          passPixelHit = pixelHit;
        }
      }
    }
    if (bounce == 0.0)
    {
      fragColor += passColor;
    }
    else
    {
      fragColor += specularCoeff * lightSpecular * passColor;
    }
    
    if(type < 0)  break;

    ray.origin = passPixelHit;
    ray.direction = reflect(ray.direction, surfaceNormal);
    
    previousType = type;
    previousIndex = index;
  }
}`;

function vertexShaderSetup(vertexShaderCode) {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders(vertexShaderCode, fragShaderCode) {
  shaderProgram = gl.createProgram();

  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragShaderCode);

  // attach the shaders
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  //link the shader program
  gl.linkProgram(shaderProgram);

  // check for compilation and linking status
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  //finally use the program.
  gl.useProgram(shaderProgram);

  return shaderProgram;
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl2"); // the graphics webgl2 context
    gl.viewportWidth = canvas.width; // the width of the canvas
    gl.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function initSquareBuffer() {
  // buffer for point locations
  const sqVertices = new Float32Array([
    1, 1, -1, 1, -1, -1, 1, -1,
  ]);
  sqVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sqVertices, gl.STATIC_DRAW);
  sqVertexPositionBuffer.itemSize = 2;
  sqVertexPositionBuffer.numItems = 4;

  // buffer for point indices
  const sqIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  sqVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sqIndices, gl.STATIC_DRAW);
  sqVertexIndexBuffer.itemsize = 1;
  sqVertexIndexBuffer.numItems = 6;
}

function drawSquare(color) {
  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    sqVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);

	gl.uniform4f(uLightLocation, light_pos[0], light_pos[1], light_pos[2], light_pos[3]); 	
	gl.uniform4f(uAmbientCoeff, mat_ambient[0], mat_ambient[1], mat_ambient[2], 1.0); 
	gl.uniform4f(uDiffusionCoeff, mat_diffuse[0], mat_diffuse[1], mat_diffuse[2], 1.0); 
	gl.uniform4f(uSpecularCoeff, mat_specular[0], mat_specular[1], mat_specular[2], 1.0); 
	gl.uniform1f(uShineCoeff, mat_shine[0]); 
	gl.uniform4f(uAmbientLight, light_ambient[0], light_ambient[1], light_ambient[2], 1.0); 
	gl.uniform4fv(uDiffusionLight, color); 
	gl.uniform4f(uSpecularLight, light_specular[0], light_specular[1], light_specular[2], 1.0);
	gl.uniform1f(uBounceLocation, bounce[0]); 

  // now draw the square
  gl.drawElements(
    gl.TRIANGLES,
    sqVertexIndexBuffer.numItems,
    gl.UNSIGNED_SHORT,
    0
  );
}

// function to draw scenes
function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(0.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if(flag == 0){
    shaderProgram = initShaders(vertexShaderCode, fragShaderCode);
  }
  else if(flag == 1){
    shaderProgram = initShaders(vertexShaderCode1, fragShaderCode1);
  }
  else if(flag == 2){
    shaderProgram = initShaders(vertexShaderCode2, fragShaderCode2);
  }
  else if(flag == 3){
    shaderProgram = initShaders(vertexShaderCode3, fragShaderCode3);
  }
  //get locations of attributes declared in the vertex shader
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  uLightLocation = gl.getUniformLocation(shaderProgram, "lightPos");
  uAmbientCoeff = gl.getUniformLocation(shaderProgram, "ambientCoeff");	
  uDiffusionCoeff = gl.getUniformLocation(shaderProgram, "diffuseCoeff");
  uSpecularCoeff = gl.getUniformLocation(shaderProgram, "specularCoeff");
  uShineCoeff = gl.getUniformLocation(shaderProgram, "matShininess");
  uAmbientLight = gl.getUniformLocation(shaderProgram, "lightAmbient");	
  uDiffusionLight = gl.getUniformLocation(shaderProgram, "lightDiffuse");
  uSpecularLight = gl.getUniformLocation(shaderProgram, "lightSpecular");
  uBounceLocation = gl.getUniformLocation(shaderProgram, "BOUNCES");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);

  bounce[0] = z;
  light_pos[0] = x;
  // eyePos[2] = z;
  drawSquare([0.0, 1.0, 0.0, 1.0]);
   
}

function changeBounceLimit(event){
  var output2 = document.getElementById("bounceValue");
  output2.innerHTML = event.target.value-1;
  z = event.target.value;
  drawScene();
}

function changeLightPos(event){
  var output1 = document.getElementById("lightValue");
  output1.innerHTML = event.target.value;
  x = event.target.value;
  drawScene();
}

function phong() {
  flag = 1;
  drawScene();
}
function phongShadow() {
  flag = 2;
  drawScene();
}
function phongReflection() {
  flag = 3;
  drawScene();
}
function phongShadowReflection() {
  flag = 0;
  drawScene();
}

// This is the entry point from the html
function webGLStart() {
  var canvas = document.getElementById("scenery2D");

  document.getElementById("lightSlider").oninput=changeLightPos;
  document.getElementById("bounceSlider").oninput=changeBounceLimit;


  document.getElementById("phongButton").addEventListener("click", phong);
  document.getElementById("phongShadowButton").addEventListener("click", phongShadow);
  document.getElementById("phongReflectionButton").addEventListener("click", phongReflection);
  document.getElementById("phongShadowReflectionButton").addEventListener("click", phongShadowReflection);


  initGL(canvas);

  initSquareBuffer();

  drawScene();
}
