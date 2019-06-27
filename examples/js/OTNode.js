"use strict";

/*function boundingPowerOfTwo(x) {
	return Math.pow(2,Math.ceil(Math.log2(x)));
}*/

class OTNode {
	constructor(bb) {
		this.bb = bb || null;
		this.children = null;
		this.parent = null;
		this.content = null;
	}
	locateBB = function(){
		var center = new THREE.Vector3();
		var size = new THREE.Vector3();
		
		return function(bb) {
			if (! this.bb.containsBox(bb)) return null;
			
			//Terminate on first vacant cell, regardless of size:
			if (this.content === null) return this;
			
			bb.getCenter(center);
			
			var in_first_x_half = bb.max.x < center.x;
			var in_second_x_half = bb.min.x > center.x;
			if (! (in_first_x_half || in_second_x_half)) return this;
			
			var in_first_y_half = bb.max.y < center.y;
			var in_second_y_half = bb.min.y > center.y;
			if (! (in_first_y_half || in_second_y_half)) return this;
			
			var in_first_z_half = bb.max.z < center.z;
			var in_second_z_half = bb.min.z > center.z;
			if (! (in_first_z_half || in_second_z_half)) return this;
			
			var child = in_second_x_half*4 + in_second_y_half*2 + in_second_z_half;
			
			if (this.children == null) {
				this.children = [null,null,null,null,null,null,null,null];
			}
			if (this.children[child] == null) {
				this.children[child] = new OTNode(
					new THREE.Box3(
						new THREE.Vector3(
							in_first_x_half ? bb.min.x : center.x,
							in_first_y_half ? bb.min.y : center.y,
							in_first_z_half ? bb.min.z : center.z
						),
						new THREE.Vector3(
							in_second_x_half ? bb.max.x : center.x,
							in_second_y_half ? bb.max.y : center.y,
							in_second_z_half ? bb.max.z : center.z,
						)
					)
				);
				this.children[child].parent = this;
			}
			
			return this.children[child].locateBB(bb);
		}
	}.call(this)
	insertObjectByBB(object, bb, minsize=0.1) {
		let otnode = this.locateBB(bb, minsize);
		if (otnode.content===null) otnode.content = [];
		otnode.content.push(object);
	}
	//Method to clone
	clone() {
		let otn = new OTNode(this.bb);
		otn.content = this.content;

		if (this.children !== null) {
			otn.children = [];
			for (let c of this.children) {
				let cn = c.clone();
				cn.parent = otn;
				otn.children.push(cn);
			}
		}
		
		return otn;
	}
}