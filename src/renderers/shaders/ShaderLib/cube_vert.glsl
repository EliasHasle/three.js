varying vec3 vWorldPosition;

void main() {

	vWorldPosition = (modelMatrix*vec4(position, 1.0)).xyz;

	#include <begin_vertex>
	#include <project_vertex>

}
