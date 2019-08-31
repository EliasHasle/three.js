//Depends on OTNode.js.

"use strict";

THREE.Mesh.prototype.raycast = ( function () {

	var inverseMatrix = new THREE.Matrix4();
	var ray = new THREE.Ray();
	var sphere = new THREE.Sphere();

	var vA = new THREE.Vector3();
	var vB = new THREE.Vector3();
	var vC = new THREE.Vector3();

	var tempA = new THREE.Vector3();
	var tempB = new THREE.Vector3();
	var tempC = new THREE.Vector3();

	var uvA = new THREE.Vector2();
	var uvB = new THREE.Vector2();
	var uvC = new THREE.Vector2();

	var barycoord = new THREE.Vector3();

	var intersectionPoint = new THREE.Vector3();
	var intersectionPointWorld = new THREE.Vector3();

	function uvIntersection( point, p1, p2, p3, uv1, uv2, uv3 ) {

		THREE.Triangle.getBarycoord( point, p1, p2, p3, barycoord );

		uv1.multiplyScalar( barycoord.x );
		uv2.multiplyScalar( barycoord.y );
		uv3.multiplyScalar( barycoord.z );

		uv1.add( uv2 ).add( uv3 );

		return uv1.clone();

	}

	function checkIntersection( object, raycaster, ray, pA, pB, pC, point ) {

		var intersect;
		var material = object.material;

		if ( material.side === THREE.BackSide ) {

			intersect = ray.intersectTriangle( pC, pB, pA, true, point );

		} else {

			intersect = ray.intersectTriangle( pA, pB, pC, material.side !== THREE.DoubleSide, point );

		}

		if ( intersect === null ) return null;

		intersectionPointWorld.copy( point );
		intersectionPointWorld.applyMatrix4( object.matrixWorld );

		var distance = raycaster.ray.origin.distanceTo( intersectionPointWorld );

		if ( distance < raycaster.near || distance > raycaster.far ) return null;

		return {
			distance: distance,
			point: intersectionPointWorld.clone(),
			object: object
		};

	}

	function checkBufferGeometryIntersection( object, raycaster, ray, positions, uvs, a, b, c ) {

		vA.fromArray( positions, a * 3 );
		vB.fromArray( positions, b * 3 );
		vC.fromArray( positions, c * 3 );

		var intersection = checkIntersection( object, raycaster, ray, vA, vB, vC, intersectionPoint );

		if ( intersection ) {

			if ( uvs ) {

				uvA.fromArray( uvs, a * 2 );
				uvB.fromArray( uvs, b * 2 );
				uvC.fromArray( uvs, c * 2 );

				intersection.uv = uvIntersection( intersectionPoint,  vA, vB, vC,  uvA, uvB, uvC );

			}

			let normal = new THREE.Vector3(); //can this be reused too?
			THREE.Triangle.getNormal( vA, vB, vC, normal);
			intersection.face = new THREE.Face3( a, b, c, normal );
			intersection.faceIndex = a;

		}

		return intersection;

	}

	return function raycast( raycaster, intersects ) {

		var geometry = this.geometry;
		var material = this.material;
		var matrixWorld = this.matrixWorld;

		if ( material === undefined ) return;

		// Checking boundingSphere distance to ray

		if ( geometry.boundingSphere === null ) geometry.computeBoundingSphere();

		sphere.copy( geometry.boundingSphere );
		sphere.applyMatrix4( matrixWorld );

		if ( raycaster.ray.intersectsSphere( sphere ) === false ) return;

		//

		inverseMatrix.getInverse( matrixWorld );
		ray.copy( raycaster.ray ).applyMatrix4( inverseMatrix );

		// Check boundingBox before continuing

		if (geometry.boundingBox === null) {
			geometry.computeBoundingBox();
		}
		
		if ( ray.intersectsBox( geometry.boundingBox ) === false ) return;

		/*TO DO: Instead of iterating over all faces of the geometry,
		first make sure the faces of the geometry are indexed in an
		octree, then cast the ray into the octree, trimming away cells
		that will never be intersected and checking the rays in a 
		good order.
		*/
		
		var intersection;
		
		if ( geometry instanceof THREE.BufferGeometry ) {
			var index = geometry.index;
			var attributes = geometry.attributes;
			var positions = attributes.position.array;
			var uvs;
			if ( attributes.uv !== undefined ) {
				uvs = attributes.uv.array;
			}
		}
			
		if (geometry.octree === undefined) {
			console.log("THREE.Mesh.raycast: Building octree for mesh %s.", this.name);

			//Octree works best with dice.
			let bbsize = new THREE.Vector3();
			geometry.boundingBox.getSize(bbsize);
			let S = Math.max(bbsize.x, bbsize.y, bbsize.z);
			let otbb = geometry.boundingBox.clone();
			otbb.min.x -= 0.5*(S-bbsize.x);
			otbb.min.y -= 0.5*(S-bbsize.y);
			otbb.min.z -= 0.5*(S-bbsize.z);
			otbb.max.x += 0.5*(S-bbsize.x);
			otbb.max.y += 0.5*(S-bbsize.y);
			otbb.max.y += 0.5*(S-bbsize.y);
			geometry.octree = new OTNode(otbb);
			
			if ( geometry instanceof THREE.BufferGeometry ) {

				var a, b, c;
	
				if ( index !== null ) {

					var indices = index.array;

					for ( var i = 0, l = indices.length; i < l; i += 3 ) {

						a = indices[ i ];
						b = indices[ i + 1 ];
						c = indices[ i + 2 ];

						let faceIndices = [a, b, c];
						let faceBB = new THREE.Box3().setFromPoints([
							new THREE.Vector3().fromArray(positions, 3*a),
							new THREE.Vector3().fromArray(positions, 3*b),
							new THREE.Vector3().fromArray(positions, 3*c),
						]);
						
						geometry.octree.insertObjectByBB(faceIndices, faceBB);
						/*intersection = checkBufferGeometryIntersection( this, raycaster, ray, positions, uvs, a, b, c );

						if ( intersection ) {

							intersection.faceIndex = Math.floor( i / 3 ); // triangle number in indices buffer semantics
							intersects.push( intersection );

						}*/

					}

				} else {


					for ( var i = 0, l = positions.length; i < l; i += 9 ) {

						a = i / 3;
						b = a + 1;
						c = a + 2;

						let faceIndices = [a, b, c];
						let faceBB = new THREE.Box3().setFromPoints([
							new THREE.Vector3().fromArray(positions, 3*a),
							new THREE.Vector3().fromArray(positions, 3*b),
							new THREE.Vector3().fromArray(positions, 3*c),
						]);
						
						geometry.octree.insertObjectByBB(faceIndices, faceBB);
						/*intersection = checkBufferGeometryIntersection( this, raycaster, ray, positions, uvs, a, b, c );

						if ( intersection ) {

							intersection.index = a; // triangle number in positions buffer semantics
							intersects.push( intersection );

						}*/

					}

				}

			} else if ( geometry instanceof THREE.Geometry ) {

				var fvA, fvB, fvC;
				var isFaceMaterial = material instanceof THREE.MultiMaterial;
				var materials = isFaceMaterial === true ? material.materials : null;

				var vertices = geometry.vertices;
				var faces = geometry.faces;
				var faceVertexUvs = geometry.faceVertexUvs[ 0 ];
				if ( faceVertexUvs.length > 0 ) uvs = faceVertexUvs;

				for ( var f = 0, fl = faces.length; f < fl; f ++ ) {

					var face = faces[ f ];
					var faceMaterial = isFaceMaterial === true ? materials[ face.materialIndex ] : material;

					if ( faceMaterial === undefined ) continue;

					fvA = vertices[ face.a ];
					fvB = vertices[ face.b ];
					fvC = vertices[ face.c ];

					if ( faceMaterial.morphTargets === true ) {

						var morphTargets = geometry.morphTargets;
						var morphInfluences = this.morphTargetInfluences;

						vA.set( 0, 0, 0 );
						vB.set( 0, 0, 0 );
						vC.set( 0, 0, 0 );

						for ( var t = 0, tl = morphTargets.length; t < tl; t ++ ) {

							var influence = morphInfluences[ t ];

							if ( influence === 0 ) continue;

							var targets = morphTargets[ t ].vertices;

							vA.addScaledVector( tempA.subVectors( targets[ face.a ], fvA ), influence );
							vB.addScaledVector( tempB.subVectors( targets[ face.b ], fvB ), influence );
							vC.addScaledVector( tempC.subVectors( targets[ face.c ], fvC ), influence );

						}

						vA.add( fvA );
						vB.add( fvB );
						vC.add( fvC );

						fvA = vA;
						fvB = vB;
						fvC = vC;

					}

					let faceIndices = [a, b, c];
					let faceBB = new THREE.Box3().setFromPoints([
						fvA, fvB, fvC
					]);
					
					geometry.octree.insertObjectByBB(faceIndices, faceBB);
				}
			}
			
			console.log("Done populating Octree.");
		}
		
		//Now raycast on the octree! Use ray.intersectBox() heavily for this.
		//Every octree node will have its bounding box.
		let otQueue = [geometry.octree];
		//positions = geometry.getAttribute("position").array;
		//uvs = geometry.getAttribute("uv").array;
		
		while (otQueue.length > 0) {
			let otn = otQueue.pop();
			if (!ray.intersectsBox(otn.bb)) continue;
			
			if (otn.content !== null) {
				for (let [a,b,c] of otn.content) {
					let intersection;
					if (geometry.isBufferGeometry) {
						intersection = checkBufferGeometryIntersection( this, raycaster, ray, positions, uvs, a, b, c );
					} else {
						fvA = geometry.vertices[ a ];
						fvB = geometry.vertices[ b ];
						fvC = geometry.vertices[ c ];
						intersection = checkIntersection( this, raycaster, ray, fvA, fvB, fvC, intersectionPoint );

						if ( intersection ) {

							if ( uvs ) {

								var uvs_f = uvs[ f ];
								uvA.copy( uvs_f[ 0 ] );
								uvB.copy( uvs_f[ 1 ] );
								uvC.copy( uvs_f[ 2 ] );

								intersection.uv = uvIntersection( intersectionPoint, fvA, fvB, fvC, uvA, uvB, uvC );

							}

							intersection.face = face;
							intersection.faceIndex = f;
						}
					}
					
					if (intersection) {
						intersects.push(intersection);
					}
				}
			}
			
			//Add subcells to queue
			if (otn.children !== null) {
				for (let c of otn.children) {
					if (c !== null) {
						otQueue.push(c);
					}
				}
			}
		}
		
		return intersects;
	};

}() );